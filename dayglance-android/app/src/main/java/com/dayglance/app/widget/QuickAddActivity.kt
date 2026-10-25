package com.dayglance.app.widget

import android.os.Bundle
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.dayglance.app.R
import com.dayglance.app.data.SharedDataStore
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/**
 * The Quick add window: a small dialog over the home screen, opened by
 * [QuickAddWidget], with one line to type. Saving queues the line in
 * [SharedDataStore] (appendQuickAdd) without starting the web app; the app puts
 * it in the Inbox the next time it runs (src/hooks/useQuickAddInbox.js).
 *
 * Its own task (taskAffinity "") and no history, so it never brings the app
 * to the front and is gone from Recents once closed.
 */
class QuickAddActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_add)
        setFinishOnTouchOutside(true)
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE or
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        )

        val input = findViewById<EditText>(R.id.quick_add_input)
        findViewById<Button>(R.id.quick_add_save).setOnClickListener { save(input) }
        findViewById<Button>(R.id.quick_add_cancel).setOnClickListener { finish() }
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                save(input)
                true
            } else {
                false
            }
        }
        input.requestFocus()
    }

    private fun save(input: EditText) {
        val title = input.text?.toString()?.trim().orEmpty()
        if (title.isEmpty()) {
            finish()
            return
        }
        val entry = JSONObject().apply {
            put("id", UUID.randomUUID().toString())
            put("title", title)
            put("createdAt", Instant.now().toString())
        }
        SharedDataStore(this).appendQuickAdd(entry)
        Toast.makeText(this, R.string.quickadd_saved, Toast.LENGTH_SHORT).show()
        finish()
    }
}
