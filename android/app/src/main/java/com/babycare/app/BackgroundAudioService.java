package com.babycare.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

import java.util.ArrayList;

public class BackgroundAudioService extends Service implements MediaPlayer.OnCompletionListener, MediaPlayer.OnErrorListener {
    public static final String ACTION_START = "com.babycare.app.BACKGROUND_AUDIO_START";
    public static final String ACTION_STOP = "com.babycare.app.BACKGROUND_AUDIO_STOP";
    private static final String CHANNEL_ID = "xixicare_sleep_audio";
    private static final int NOTIFICATION_ID = 1048;
    private static volatile String activeTrackId = "";
    private static volatile int activePositionMs = 0;
    private static volatile boolean activePlaying = false;
    private static volatile BackgroundAudioService instance;

    private final ArrayList<String> urls = new ArrayList<>();
    private final ArrayList<String> ids = new ArrayList<>();
    private MediaPlayer player;
    private int index;
    private String loopMode = "list";
    private float volume = 0.45f;
    private int playbackGeneration;

    @Override public void onCreate() { super.onCreate(); instance = this; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            captureState();
            stopPlayback();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        ArrayList<String> nextUrls = intent.getStringArrayListExtra("urls");
        ArrayList<String> nextIds = intent.getStringArrayListExtra("ids");
        if (nextUrls == null || nextIds == null || nextUrls.isEmpty()) return START_NOT_STICKY;
        urls.clear(); urls.addAll(nextUrls);
        ids.clear(); ids.addAll(nextIds);
        index = Math.max(0, Math.min(intent.getIntExtra("index", 0), urls.size() - 1));
        loopMode = intent.getStringExtra("loopMode");
        volume = intent.getFloatExtra("volume", 0.45f);
        createChannel();
        startForeground(NOTIFICATION_ID, notification());
        playCurrent(Math.max(0, intent.getIntExtra("positionMs", 0)));
        return START_NOT_STICKY;
    }

    private void playCurrent(int positionMs) {
        stopPlayback();
        final int generation = ++playbackGeneration;
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            player.setDataSource(urls.get(index));
            player.setLooping("track".equals(loopMode));
            player.setVolume(volume, volume);
            activeTrackId = ids.get(index);
            activePositionMs = positionMs;
            activePlaying = false;
            player.setOnPreparedListener(mediaPlayer -> {
                if (generation != playbackGeneration || mediaPlayer != player) return;
                if (positionMs > 0) mediaPlayer.seekTo(positionMs);
                mediaPlayer.start();
                activePlaying = true;
            });
            player.setOnCompletionListener(this);
            player.setOnErrorListener(this);
            player.prepareAsync();
        } catch (Exception error) {
            activePlaying = false;
            stopSelf();
        }
    }

    @Override
    public void onCompletion(MediaPlayer mediaPlayer) {
        if ("list".equals(loopMode) && !urls.isEmpty()) {
            index = (index + 1) % urls.size();
            playCurrent(0);
        } else {
            captureState();
            activePlaying = false;
            stopForeground(true);
            stopSelf();
        }
    }

    @Override
    public boolean onError(MediaPlayer mediaPlayer, int what, int extra) {
        if ("list".equals(loopMode) && urls.size() > 1) {
            index = (index + 1) % urls.size();
            playCurrent(0);
            return true;
        }
        activePlaying = false;
        stopSelf();
        return true;
    }

    private void captureState() {
        if (player != null) {
            try { activePositionMs = player.getCurrentPosition(); activePlaying = player.isPlaying(); }
            catch (IllegalStateException ignored) { }
        }
        if (!ids.isEmpty() && index < ids.size()) activeTrackId = ids.get(index);
    }

    private void stopPlayback() {
        playbackGeneration += 1;
        if (player == null) return;
        try { player.stop(); } catch (IllegalStateException ignored) { }
        player.release();
        player = null;
    }

    public static JSObject snapshot() {
        BackgroundAudioService service = instance;
        if (service != null) service.captureState();
        JSObject result = new JSObject();
        result.put("trackId", activeTrackId);
        result.put("positionMs", activePositionMs);
        result.put("playing", activePlaying);
        return result;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "睡眠声音", NotificationManager.IMPORTANCE_LOW);
        channel.setSound(null, null);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification notification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pending = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("XiXiCare 睡眠声音")
                .setContentText("正在后台播放")
                .setContentIntent(pending)
                .setOngoing(true)
                .setSilent(true)
                .build();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() { captureState(); stopPlayback(); instance = null; super.onDestroy(); }
}
