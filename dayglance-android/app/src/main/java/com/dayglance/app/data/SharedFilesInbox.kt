package com.dayglance.app.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID

/**
 * Files and text shared to the app from another app's share sheet (images,
 * PDFs, audio, a note from a notes app), on their way to becoming a note,
 * the files its attachments (src/hooks/useSharedFilesToNotes.js).
 *
 * The sharing app's read grant on a content:// URI lasts only as long as the
 * receiving Activity, so each file is copied into the app's own storage at
 * once. One share is one "batch": its files, and the text and subject shared
 * with them. Batches wait in SharedPreferences until the web app has made its
 * note and acknowledges them ([ack]); only then are the copies deleted, so an
 * app that dies in between reads them again.
 */
object SharedFilesInbox {
    private const val PREFS = "dayglance_shared"
    private const val KEY = "shared_files_queue"
    private const val DIR = "shared_in"
    /** As src/utils/attachments.js MAX_ATTACHMENT_BYTES. */
    const val MAX_BYTES = 20L * 1024 * 1024
    /** Shared text kept per share: far beyond a note, well within the prefs. */
    private const val MAX_TEXT = 200_000
    private val LOCK = Any()

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun dir(context: Context) = File(context.filesDir, DIR).apply { mkdirs() }

    private fun accepted(mime: String?): Boolean {
        val m = mime?.lowercase() ?: return false
        return m.startsWith("image/") || m == "application/pdf" || m.startsWith("audio/")
    }

    @Suppress("DEPRECATION")
    private fun streams(intent: Intent): List<Uri> = when (intent.action) {
        Intent.ACTION_SEND -> listOfNotNull(
            if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            else intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        )
        Intent.ACTION_SEND_MULTIPLE -> (
            if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
            else intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
        ).orEmpty()
        else -> emptyList()
    }

    /**
     * Copies the files of a share intent and queues them, with its text, as
     * one batch. Text shared alone is a batch without files. Returns false
     * when the intent carries neither.
     */
    fun store(context: Context, intent: Intent): Boolean {
        val uris = streams(intent)
        val text = (intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: "").take(MAX_TEXT)
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            ?: intent.getStringExtra(Intent.EXTRA_TITLE) ?: ""
        if (uris.isEmpty() && text.isBlank()) return false
        val resolver = context.contentResolver
        val files = JSONArray()
        var skipped = 0
        for (uri in uris) {
            try {
                val mime = resolver.getType(uri) ?: intent.type
                if (!accepted(mime)) { skipped++; continue }
                var name: String? = null
                resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                    if (c.moveToFirst()) name = c.getString(0)
                }
                val id = UUID.randomUUID().toString()
                val target = File(dir(context), id)
                var size = 0L
                var tooLarge = false
                val stream = resolver.openInputStream(uri)
                if (stream == null) { skipped++; continue }
                stream.use { input ->
                    target.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            size += n
                            if (size > MAX_BYTES) { tooLarge = true; break }
                            output.write(buffer, 0, n)
                        }
                    }
                }
                if (tooLarge) { target.delete(); skipped++; continue }
                files.put(JSONObject().apply {
                    put("id", id)
                    put("name", name ?: id)
                    put("mime", mime)
                    put("size", size)
                })
            } catch (_: Exception) {
                skipped++
            }
        }
        val batch = JSONObject().apply {
            put("batchId", UUID.randomUUID().toString())
            put("text", text)
            put("subject", subject)
            put("files", files)
            put("skipped", skipped)
        }
        synchronized(LOCK) {
            val queue = runCatching { JSONArray(prefs(context).getString(KEY, "[]")) }.getOrDefault(JSONArray())
            queue.put(batch)
            prefs(context).edit().putString(KEY, queue.toString()).commit()
        }
        return true
    }

    /** The queued batches, as JSON. */
    fun peek(context: Context): String = synchronized(LOCK) {
        prefs(context).getString(KEY, null) ?: "[]"
    }

    /**
     * [length] bytes of a copied file from [offset], as base64 (no line
     * breaks). The web app reads a file in pieces whose length is a multiple
     * of 3, so the pieces' base64 joins into the whole file's. "" past the end
     * or when the file is gone.
     */
    fun readChunk(context: Context, id: String, offset: Long, length: Int): String {
        if (id.contains('/') || id.contains("..")) return ""
        val file = File(dir(context), id)
        if (!file.exists() || offset >= file.length()) return ""
        RandomAccessFile(file, "r").use { raf ->
            raf.seek(offset)
            val n = minOf(length.toLong(), file.length() - offset).toInt()
            val bytes = ByteArray(n)
            raf.readFully(bytes)
            return Base64.encodeToString(bytes, Base64.NO_WRAP)
        }
    }

    /** The web app has made its notes: drop these batches and their copies. */
    fun ack(context: Context, batchIdsJson: String) {
        val ids = runCatching {
            val arr = JSONArray(batchIdsJson)
            (0 until arr.length()).map { arr.getString(it) }.toSet()
        }.getOrDefault(emptySet())
        if (ids.isEmpty()) return
        synchronized(LOCK) {
            val queue = runCatching { JSONArray(prefs(context).getString(KEY, "[]")) }.getOrDefault(JSONArray())
            val kept = JSONArray()
            for (i in 0 until queue.length()) {
                val batch = queue.optJSONObject(i) ?: continue
                if (batch.optString("batchId") in ids) {
                    val files = batch.optJSONArray("files") ?: JSONArray()
                    for (j in 0 until files.length()) {
                        val fid = files.optJSONObject(j)?.optString("id").orEmpty()
                        if (fid.isNotEmpty() && !fid.contains('/')) File(dir(context), fid).delete()
                    }
                } else {
                    kept.put(batch)
                }
            }
            if (kept.length() == 0) prefs(context).edit().remove(KEY).commit()
            else prefs(context).edit().putString(KEY, kept.toString()).commit()
        }
    }
}
