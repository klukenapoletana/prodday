package com.dayglance.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.dayglance.app.R

/**
 * "Quick add" home screen widget: one button, "+ New entry", which opens
 * [QuickAddActivity] over the home screen. The line typed there lands in the
 * Inbox (src/hooks/useQuickAddInbox.js). The widget shows no data, so it needs
 * no snapshot and no refresh.
 */
class QuickAddWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            try {
                val views = RemoteViews(context.packageName, R.layout.widget_quick_add)
                val intent = Intent(context, QuickAddActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                val pending = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.quick_add_root, pending)
                appWidgetManager.updateAppWidget(id, views)
            } catch (_: Throwable) { }
        }
    }
}
