package com.knackeredtv.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

/**
 * Full-screen view of the shared {@link Playback}. Going back leaves the video running in the mini player.
 */
@OptIn(markerClass = UnstableApi.class)
public final class PlayerActivity extends Activity {
    private static final String[] ASPECT_LABELS = {"Fit to screen", "Fill screen (zoom, may crop)", "Stretch to fill", "16:9", "4:3"};
    private static final String[] ASPECT_SHORT = {"Fit", "Zoom", "Stretch", "16:9", "4:3"};
    private static final long TOP_BAR_TIMEOUT_MS = 3500;

    static void live(Context context, String title, String url, String fallback) {
        Playback.play(context, new Playback.Request(title, url, fallback, true, 0, null));
        open(context);
    }

    /** Plays a movie or an episode and remembers where the viewer stopped. */
    static void vod(Context context, String title, String url, HistoryStore.Entry meta, long startSeconds) {
        Playback.play(context, new Playback.Request(title, url, null, false, startSeconds, meta));
        open(context);
    }

    static void open(Context context) {
        context.startActivity(new Intent(context, PlayerActivity.class));
    }

    private Ui.AspectBox box;
    private PlayerView playerView;
    private View topBar;
    private TextView status, aspectButton;
    private LinearLayout errorActions;
    private int aspect;
    private boolean wasFailed;
    private final Playback.Listener listener = this::refresh;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Ui.allowCutout(this);
        if (!Playback.hasMedia()) { finish(); return; }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        aspect = Math.min(ASPECT_LABELS.length - 1, Math.max(0, prefs().getInt("player_aspect", 0)));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        box = new Ui.AspectBox(this);
        playerView = new PlayerView(this);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerView.setControllerShowTimeoutMs(3500);
        box.addView(playerView);
        root.addView(box, new FrameLayout.LayoutParams(-1, -1));

        int pad = Ui.dp(this, 12);
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xCC000000, 0x00000000}));
        bar.setPadding(pad, pad, pad, Ui.dp(this, 24));
        bar.addView(Ui.glassButton(this, "←  Back", this::finish));
        TextView title = Ui.text(this, Playback.title(), 18, Ui.WHITE, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setPadding(Ui.dp(this, 14), 0, Ui.dp(this, 10), 0);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        aspectButton = Ui.glassButton(this, "", this::chooseAspect);
        LinearLayout.LayoutParams gap = Ui.margins(new LinearLayout.LayoutParams(-2, -2), 0, 0, Ui.dp(this, 8), 0);
        bar.addView(aspectButton, gap);
        bar.addView(Ui.dangerButton(this, "✕  Stop", Playback::stop));
        topBar = bar;
        root.addView(bar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> {
            if (visibility == View.VISIBLE) showTopBar();
        });
        showTopBar();

        LinearLayout center = new LinearLayout(this);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER);
        status = Ui.text(this, "", 15, Ui.WHITE, false);
        status.setGravity(Gravity.CENTER);
        status.setPadding(pad * 2, 0, pad * 2, 0);
        center.addView(status);
        errorActions = new LinearLayout(this);
        errorActions.setGravity(Gravity.CENTER);
        errorActions.setVisibility(View.GONE);
        LinearLayout.LayoutParams actionGap = new LinearLayout.LayoutParams(-2, -2);
        actionGap.setMargins(pad / 2, pad, pad / 2, 0);
        errorActions.addView(Ui.primaryButton(this, "Retry", Playback::retry), actionGap);
        errorActions.addView(Ui.glassButton(this, "Close", Playback::stop), actionGap);
        center.addView(errorActions);
        FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        centerParams.topMargin = Ui.dp(this, 70);
        root.addView(center, centerParams);
        setContentView(root);

        // The video fills the whole display (including behind a camera cutout); only the controls stay clear of it
        Ui.watchInsets(root, r -> {
            topBar.setPadding(pad + r.left, pad + r.top, pad + r.right, Ui.dp(this, 24));
            View controller = playerView.findViewById(androidx.media3.ui.R.id.exo_controller);
            if (controller != null) controller.setPadding(r.left, 0, r.right, r.bottom);
        });
        applyAspect();
    }

    private SharedPreferences prefs() { return getSharedPreferences("ui", MODE_PRIVATE); }

    /** Shows the top bar and hides it again after a few seconds, whatever the playback controls are doing. */
    private void showTopBar() {
        topBar.setVisibility(View.VISIBLE);
        topBar.removeCallbacks(hideTopBar);
        if (!Playback.failed) topBar.postDelayed(hideTopBar, TOP_BAR_TIMEOUT_MS);
    }

    private final Runnable hideTopBar = () -> {
        if (!Playback.failed) topBar.setVisibility(View.GONE);
    };

    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN && topBar != null) showTopBar();
        return super.dispatchTouchEvent(event);
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && topBar != null) showTopBar();
        return super.dispatchKeyEvent(event);
    }

    private void chooseAspect() {
        new AlertDialog.Builder(this).setTitle("Screen size")
                .setSingleChoiceItems(ASPECT_LABELS, aspect, (dialog, which) -> {
                    aspect = which;
                    prefs().edit().putInt("player_aspect", which).apply();
                    applyAspect();
                    dialog.dismiss();
                }).show();
    }

    private void applyAspect() {
        switch (aspect) {
            case 1: // zoom: fill the screen, cropping the edges
                box.setRatio(0);
                playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
                break;
            case 2: // stretch the picture to the whole screen
                box.setRatio(0);
                playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL);
                break;
            case 3:
                box.setRatio(16f / 9f);
                playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL);
                break;
            case 4:
                box.setRatio(4f / 3f);
                playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL);
                break;
            default:
                box.setRatio(0);
                playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        }
        aspectButton.setText("⛶  " + ASPECT_SHORT[aspect] + " ▾");
    }

    private void refresh() {
        if (!Playback.hasMedia()) {
            playerView.setPlayer(null);
            finish();
            return;
        }
        status.setText(Playback.status);
        errorActions.setVisibility(Playback.failed ? View.VISIBLE : View.GONE);
        if (Playback.failed) {
            topBar.removeCallbacks(hideTopBar);
            topBar.setVisibility(View.VISIBLE);
        } else if (wasFailed) {
            showTopBar();
        }
        wasFailed = Playback.failed;
    }

    @Override protected void onStart() {
        super.onStart();
        if (!Playback.hasMedia()) return;
        playerView.setPlayer(Playback.player());
        Playback.addListener(listener);
        refresh();
        Playback.resumeFromBackground();
    }

    // The mini player on the home screen takes over as soon as this screen is no longer in front
    @Override protected void onResume() {
        super.onResume();
        Playback.fullScreenVisible = true;
    }

    @Override protected void onPause() {
        Playback.fullScreenVisible = false;
        super.onPause();
    }

    @Override protected void onStop() {
        Playback.removeListener(listener);
        if (topBar != null) topBar.removeCallbacks(hideTopBar);
        if (playerView != null) playerView.setPlayer(null);
        if (!isFinishing()) Playback.pauseForBackground();
        else Playback.saveProgress();
        super.onStop();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive(this);
    }

    @SuppressWarnings("deprecation")
    static void immersive(Activity activity) {
        activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
}
