package com.xixicare.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.net.Uri;
import android.widget.RemoteViews;
import androidx.core.content.FileProvider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class FormulaWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "widget_charts";
    private static final String ACTION_TYPE = "com.xixicare.app.widget.CHART_TYPE";
    private static final String[] NAMES = { "瓶喂奶量", "睡眠时长", "喂养间隔" };
    private static final String[] UNITS = { "ml", "小时", "小时" };
    private static final int[] LIGHT_COLORS = { 0xFFD99A72, 0xFF988FB5, 0xFF7A9A8B };
    private static final int[] DARK_COLORS = { 0xFFE2A47F, 0xFFB2A8CB, 0xFF9FC0AC };
    private static final ExecutorService RENDERER = Executors.newSingleThreadExecutor();

    public static void refreshAll(Context context) {
        Context appContext = context.getApplicationContext();
        RENDERER.execute(() -> {
            AppWidgetManager manager = AppWidgetManager.getInstance(appContext);
            int[] ids = manager.getAppWidgetIds(new ComponentName(appContext, FormulaWidgetProvider.class));
            render(appContext, manager, ids);
        });
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        android.content.BroadcastReceiver.PendingResult pending = goAsync();
        Context appContext = context.getApplicationContext();
        RENDERER.execute(() -> {
            try { render(appContext, manager, ids); }
            finally { pending.finish(); }
        });
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (!ACTION_TYPE.equals(action)) return;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String key = "type_" + id;
        prefs.edit().putInt(key, (prefs.getInt(key, 0) + 1) % NAMES.length).apply();
        android.content.BroadcastReceiver.PendingResult pending = goAsync();
        Context appContext = context.getApplicationContext();
        RENDERER.execute(() -> {
            try { render(appContext, AppWidgetManager.getInstance(appContext), new int[] { id }); }
            finally { pending.finish(); }
        });
    }

    @Override public void onDeleted(Context context, int[] ids) {
        SharedPreferences.Editor edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) edit.remove("type_" + id);
        edit.apply();
    }

    private static PendingIntent toggle(Context context, int id, String action, int offset) {
        Intent intent = new Intent(context, FormulaWidgetProvider.class);
        intent.setAction(action);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        return PendingIntent.getBroadcast(context, id * 4 + offset, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context context, int id, int type) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.putExtra("from", "vivo_atom_widget");
        intent.putExtra("target", "stats");
        intent.putExtra("chartType", dataKey(type));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, id * 4 + 3, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray daily;
        try { daily = new JSONArray(prefs.getString("daily", "[]")); }
        catch (Exception error) { daily = new JSONArray(); }
        boolean dark = (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        for (int id : ids) {
            int type = Math.floorMod(prefs.getInt("type_" + id, 0), 3);
            double[] values = buckets(daily, type);
            double dailyAverage = recordedDailyAverage(daily, type);
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.formula_widget);
            views.setTextViewText(R.id.chart_type_button, NAMES[type] + " · 近7天");
            String amount = averageLabel(dailyAverage, type);
            String summary = type <= 1
                ? (dailyAverage > 0 ? "日均 " + amount + UNITS[type] + "（不包含今日）" : "日均 暂无数据（不包含今日）")
                : (dailyAverage > 0 ? "近7天记录日均 " + amount + UNITS[type] : "近7天暂无" + NAMES[type] + "记录");
            views.setTextViewText(R.id.chart_summary, summary);
            Uri chartUri = writeChart(context, id, chart(values, labels(daily), type, DARK_COLORS[type], LIGHT_COLORS[type], dark));
            if (chartUri != null) views.setImageViewUri(R.id.chart_image, chartUri);
            views.setOnClickPendingIntent(R.id.chart_switch_button, toggle(context, id, ACTION_TYPE, 1));
            PendingIntent open = openApp(context, id, type);
            views.setOnClickPendingIntent(R.id.formula_widget_root, open);
            views.setOnClickPendingIntent(R.id.chart_type_button, open);
            views.setOnClickPendingIntent(R.id.chart_image, open);
            views.setOnClickPendingIntent(R.id.chart_summary, open);
            manager.updateAppWidget(id, views);
        }
    }

    private static Uri writeChart(Context context, int id, Bitmap bitmap) {
        File directory = new File(context.getCacheDir(), "widget-charts");
        if (!directory.exists() && !directory.mkdirs()) return null;
        File[] oldFiles = directory.listFiles((dir, name) -> name.startsWith("chart-" + id + "-"));
        File target = new File(directory, "chart-" + id + "-" + System.currentTimeMillis() + ".png");
        try (FileOutputStream output = new FileOutputStream(target)) {
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) return null;
        } catch (Exception error) {
            return null;
        } finally {
            bitmap.recycle();
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", target);
        Intent homeIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        PackageManager packageManager = context.getPackageManager();
        List<ResolveInfo> launchers = packageManager.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo launcher : launchers) {
            context.grantUriPermission(launcher.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        if (oldFiles != null) for (File oldFile : oldFiles) oldFile.delete();
        return uri;
    }

    private static String dataKey(int type) {
        return type == 0 ? "milk" : type == 1 ? "sleep" : "interval";
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.CHINA).format(new Date());
    }

    private static double recordedDailyAverage(JSONArray daily, int type) {
        double total = 0;
        int recordedDays = 0;
        int start = Math.max(0, daily.length() - 7);
        String today = todayKey();
        for (int index = start; index < daily.length(); index++) {
            JSONObject item = daily.optJSONObject(index);
            if (item == null || (type <= 1 && today.equals(item.optString("date")))) continue;
            double value = Math.max(0, item.optDouble(dataKey(type), 0));
            if (value > 0) { total += value; recordedDays++; }
        }
        return recordedDays == 0 ? 0 : total / recordedDays;
    }

    private static double[] buckets(JSONArray daily, int type) {
        int count = 7;
        double[] values = new double[count];
        int[] recordedDays = new int[count];
        int start = Math.max(0, daily.length() - 7);
        for (int index = start; index < daily.length(); index++) {
            JSONObject item = daily.optJSONObject(index);
            if (item == null) continue;
            double value = Math.max(0, item.optDouble(dataKey(type), 0));
            int bucket = index - start;
            if (value > 0) { values[bucket] += value; recordedDays[bucket]++; }
        }
        for (int index = 0; index < count; index++) {
            if (recordedDays[index] > 0) values[index] /= recordedDays[index];
        }
        return values;
    }

    private static String[] labels(JSONArray daily) {
        int count = 7;
        String[] labels = new String[count];
        int start = Math.max(0, daily.length() - 7);
        for (int index = 0; index < count; index++) {
            int first = start + index;
            JSONObject begin = daily.optJSONObject(first);
            String firstDate = begin == null ? "" : begin.optString("date", "");
            if (firstDate.length() >= 10) {
                labels[index] = firstDate.substring(8);
            } else labels[index] = "";
        }
        return labels;
    }

    private static String averageLabel(double value, int type) {
        if (type == 1 || type == 2) return String.format(java.util.Locale.CHINA, "%.1f", value / 60d);
        return String.valueOf(Math.round(value));
    }

    private static String valueLabel(double value, int type) {
        return averageLabel(value, type) + (type == 1 || type == 2 ? "h" : "");
    }

    private static Bitmap chart(double[] values, String[] labels, int type, int darkColor, int lightColor, boolean dark) {
        // Send the chart through a content URI so the desktop receives a crisp 3x image
        // without crossing vivo's 100 KB RemoteViews bitmap limit.
        final int width = 840;
        final int height = 156;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
        int textColor = dark ? 0xFFF2F4F1 : 0xFF302B27;
        int mutedColor = dark ? 0xFFBCC8C0 : 0xFF736C65;
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        float step = (float) width / values.length;
        double maximum = 0;
        for (double value : values) maximum = Math.max(maximum, value);
        paint.setColor(dark ? 0xFF526057 : 0xFFE8E1DA);
        paint.setStrokeWidth(4);
        canvas.drawLine(0, 112, width, 112, paint);
        for (int index = 0; index < values.length; index++) {
            float center = step * (index + .5f);
            double value = values[index];
            paint.setColor(dark ? darkColor : lightColor);
            float barHeight = maximum <= 0 || value <= 0 ? 0 : (float) (value / maximum * 56d);
            if (barHeight > 0) canvas.drawRoundRect(center - 25, 112 - barHeight, center + 25, 112, 12, 12, paint);
            paint.setTextSize(36);
            paint.setColor(textColor);
            canvas.drawText(valueLabel(value, type), center, Math.max(34, 100 - barHeight), paint);
            paint.setTextSize(30);
            paint.setColor(mutedColor);
            canvas.drawText(labels[index], center, 151, paint);
        }
        return bitmap;
    }
}
