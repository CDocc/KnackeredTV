package com.knackeredtv.android;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.ArrayList;
import java.util.List;

/**
 * The one ExoPlayer for the whole app. It outlives the full-screen screen so that backing out of full
 * screen leaves the video running in the mini player, like the desktop app.
 */
@OptIn(markerClass = UnstableApi.class)
final class Playback {
    static final class Request {
        final String title, url, fallback;
        final boolean live;
        final long start; // seconds
        final HistoryStore.Entry meta; // null for live TV

        Request(String title, String url, String fallback, boolean live, long start, HistoryStore.Entry meta) {
            this.title = title; this.url = url; this.fallback = fallback; this.live = live; this.start = start; this.meta = meta;
        }
    }

    interface Listener { void onPlaybackChanged(); }

    private static final long STARTUP_TIMEOUT_MS = 20000;
    private static final long SAVE_INTERVAL_MS = 15000;
    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static final List<Listener> LISTENERS = new ArrayList<>();

    private static Context app;
    private static ExoPlayer player;
    private static Request request;
    private static boolean triedFallback, pausedForBackground;

    static boolean started, failed, muted;
    /** True while the full-screen player is the foreground screen; the mini player hides then. */
    static boolean fullScreenVisible;
    static String status = "";

    private static final Runnable TIMEOUT = () -> fail("The stream took too long to start");
    private static final Runnable SAVER = new Runnable() {
        @Override public void run() {
            saveProgress();
            if (request != null && !request.live) HANDLER.postDelayed(this, SAVE_INTERVAL_MS);
        }
    };

    private Playback() {}

    static boolean hasMedia() { return request != null; }

    static ExoPlayer player() { return player; }

    static String title() { return request == null ? "" : request.title; }

    static void addListener(Listener listener) { if (!LISTENERS.contains(listener)) LISTENERS.add(listener); }

    static void removeListener(Listener listener) { LISTENERS.remove(listener); }

    private static void changed() {
        for (Listener listener : new ArrayList<>(LISTENERS)) listener.onPlaybackChanged();
    }

    static void play(Context context, Request next) {
        app = context.getApplicationContext();
        if (request != null && player != null && request.url.equals(next.url) && !failed) {
            // Same stream again: keep it running instead of reconnecting
            request = next;
            if (!next.live) player.seekTo(next.start * 1000);
            player.play();
            changed();
            return;
        }
        saveProgress();
        request = next;
        ensurePlayer();
        triedFallback = false;
        begin(next.url, next.start);
        HANDLER.removeCallbacks(SAVER);
        if (!next.live) HANDLER.postDelayed(SAVER, SAVE_INTERVAL_MS);
    }

    private static void ensurePlayer() {
        if (player != null) return;
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent("KnackeredTV").setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000).setReadTimeoutMs(20000);
        player = new ExoPlayer.Builder(app, new DefaultRenderersFactory(app).setEnableDecoderFallback(true))
                .setMediaSourceFactory(new DefaultMediaSourceFactory(app).setDataSourceFactory(http))
                .setHandleAudioBecomingNoisy(true).build();
        player.setAudioAttributes(AudioAttributes.DEFAULT, true);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) {
                    started = true;
                    failed = false;
                    HANDLER.removeCallbacks(TIMEOUT);
                    status = "";
                    changed();
                } else if (state == Player.STATE_BUFFERING && !started) {
                    status = "Loading stream…";
                    changed();
                } else if (state == Player.STATE_ENDED) {
                    saveProgress();
                }
            }

            @Override public void onPlayerError(PlaybackException error) {
                fail("Unable to play this stream. Check the server, your credentials, or connection limit.");
            }
        });
    }

    private static void begin(String source, long startSeconds) {
        if (player == null) return;
        started = false;
        failed = false;
        pausedForBackground = false;
        status = "Loading stream…";
        player.setVolume(muted ? 0f : 1f);
        HANDLER.removeCallbacks(TIMEOUT);
        HANDLER.postDelayed(TIMEOUT, STARTUP_TIMEOUT_MS);
        MediaItem.Builder item = new MediaItem.Builder().setUri(source);
        if (source.toLowerCase(java.util.Locale.ROOT).contains(".m3u8")) item.setMimeType("application/x-mpegURL");
        player.setMediaItem(item.build(), startSeconds > 0 ? startSeconds * 1000 : C.TIME_UNSET);
        player.prepare();
        player.play();
        changed();
    }

    private static void fail(String reason) {
        HANDLER.removeCallbacks(TIMEOUT);
        if (player == null || request == null) return;
        if (!triedFallback && request.fallback != null && !request.fallback.isEmpty()) {
            triedFallback = true;
            begin(request.fallback, 0);
            return;
        }
        player.stop();
        failed = true;
        status = reason;
        changed();
    }

    static void retry() {
        if (request == null) return;
        triedFallback = false;
        begin(request.url, request.live ? 0 : currentSeconds());
    }

    static long currentSeconds() { return player == null ? 0 : Math.max(0, player.getCurrentPosition() / 1000); }

    static void saveProgress() {
        if (request == null || request.live || request.meta == null || player == null || !started) return;
        if (Session.history == null) return;
        long duration = player.getDuration() == C.TIME_UNSET ? 0 : player.getDuration() / 1000;
        if (duration <= 0) return;
        long position = player.getPlaybackState() == Player.STATE_ENDED ? duration : currentSeconds();
        HistoryStore.Entry m = request.meta;
        Session.history.save(new HistoryStore.Entry(m.kind, m.id, m.title, m.image, m.ext, m.seriesId, m.season,
                m.episode, position, duration, System.currentTimeMillis()));
    }

    static void setMuted(boolean value) {
        muted = value;
        if (player != null) player.setVolume(value ? 0f : 1f);
        changed();
    }

    /** Pauses when the app leaves the screen; the mini player or full screen resumes it. */
    static void pauseForBackground() {
        if (player == null || request == null || !player.getPlayWhenReady()) return;
        player.pause();
        pausedForBackground = true;
        saveProgress();
    }

    static void resumeFromBackground() {
        if (!pausedForBackground || player == null) return;
        pausedForBackground = false;
        if (request != null && request.live) player.seekToDefaultPosition();
        player.play();
    }

    static void stop() {
        saveProgress();
        HANDLER.removeCallbacks(TIMEOUT);
        HANDLER.removeCallbacks(SAVER);
        request = null;
        status = "";
        started = false;
        failed = false;
        pausedForBackground = false;
        // Views detach in the callbacks, so the player is released afterwards
        changed();
        if (player != null) {
            player.release();
            player = null;
        }
    }

    /** Lets screen tests show the mini player without opening a network stream. */
    static void setRequestForTest(Request value, String text) {
        request = value;
        status = text;
        started = false;
        failed = false;
    }
}
