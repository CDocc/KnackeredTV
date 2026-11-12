package com.knackeredtv.android;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.annotation.OptIn;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.ui.PlayerView;
import java.text.DateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** The signed-in shell: a sidebar like the desktop app plus the selected page. */
@OptIn(markerClass = UnstableApi.class)
public final class HomeActivity extends Activity {
    private final Map<String, Page> pages = new HashMap<>();
    private final Map<String, LinearLayout> navItems = new LinkedHashMap<>();
    private FrameLayout pageHost, overlayHost;
    private String current;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        Ui.allowCutout(this);
        if (Session.profile == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }
        FrameLayout root = new FrameLayout(this);
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        int margin = Ui.dp(this, Ui.compact(this) ? 10 : 16);
        root.addView(row, new FrameLayout.LayoutParams(-1, -1));
        Ui.applyInsets(root, margin);

        row.addView(buildSidebar(), new LinearLayout.LayoutParams(sidebarWidth(), -1));
        FrameLayout content = new FrameLayout(this);
        pageHost = new FrameLayout(this);
        overlayHost = new FrameLayout(this);
        content.addView(pageHost, new FrameLayout.LayoutParams(-1, -1));
        content.addView(overlayHost, new FrameLayout.LayoutParams(-1, -1));
        row.addView(content, Ui.margins(new LinearLayout.LayoutParams(0, -1, 1), margin, 0, 0, 0));
        buildMini(root);
        setContentView(root);
        select("live");
        if (UpdateChecker.last != null) showUpdateBadge();
        else Session.run(this, () -> UpdateChecker.check(UpdateChecker.currentVersion(this)), r -> showUpdateBadge(), null);
    }

    /** Marks the Settings entry when a newer release is out; the change log is on the Settings page. */
    void showUpdateBadge() {
        LinearLayout item = navItems.get("settings");
        if (item == null || UpdateChecker.last == null) return;
        ((TextView) item.getChildAt(1)).setText(UpdateChecker.last.updateAvailable() ? "Settings  ● Update" : "Settings");
    }

    private int sidebarWidthDp() { return Math.max(176, Math.min(256, Math.round(Ui.widthDp(this) * 0.22f))); }

    private int sidebarWidth() { return Ui.dp(this, sidebarWidthDp()); }

    private View buildSidebar() {
        boolean compact = Ui.compact(this);
        LinearLayout sidebar = Ui.panel(this);
        int pad = Ui.dp(this, compact ? 10 : 16);
        sidebar.setPadding(pad, pad, pad, pad);

        LinearLayout brand = new LinearLayout(this);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.kn_logo);
        int logoSize = Ui.dp(this, compact ? 30 : 40);
        brand.addView(logo, new LinearLayout.LayoutParams(logoSize, logoSize));
        TextView title = Ui.gradientTitle(this, "KnackeredTV", compact ? 16 : sidebarWidthDp() >= 240 ? 22 : 18);
        title.setSingleLine(true);
        title.setPadding(Ui.dp(this, 8), 0, 0, 0);
        brand.addView(title);
        sidebar.addView(brand);

        TextView profile = Ui.text(this, Session.profile.name, 12, Ui.WHITE40, false);
        profile.setSingleLine(true);
        profile.setEllipsize(TextUtils.TruncateAt.END);
        profile.setPadding(0, Ui.dp(this, 4), 0, Ui.dp(this, compact ? 6 : 12));
        sidebar.addView(profile);

        if (Session.account != null && !compact) sidebar.addView(accountCard());

        LinearLayout nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.VERTICAL);
        addNav(nav, "live", "📺", "Live TV");
        if (Session.isXtream()) {
            addNav(nav, "movies", "🎬", "Movies");
            addNav(nav, "series", "📺", "Series");
        }
        addNav(nav, "favorites", "★", "Favorites");
        addNav(nav, "search", "🔍", "Search");
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(nav);
        sidebar.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));

        View divider = new View(this);
        divider.setBackgroundColor(0x1AFFFFFF);
        sidebar.addView(divider, Ui.margins(new LinearLayout.LayoutParams(-1, Ui.dp(this, 1)), 0, Ui.dp(this, 6), 0, Ui.dp(this, 6)));

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        addNav(bottom, "switch", "👤", "Switch profile");
        addNav(bottom, "settings", "⚙️", "Settings");
        sidebar.addView(bottom);
        return sidebar;
    }

    private View accountCard() {
        LinearLayout card = Ui.card(this);
        int pad = Ui.dp(this, 10);
        card.setPadding(pad, pad, pad, pad);
        LinearLayout statusRow = new LinearLayout(this);
        statusRow.addView(Ui.text(this, "Status:", 12, Ui.WHITE60, false), new LinearLayout.LayoutParams(0, -2, 1));
        boolean active = Session.account.status.equalsIgnoreCase("active");
        statusRow.addView(Ui.text(this, Session.account.status, 12, active ? Ui.GREEN : Ui.RED, true));
        card.addView(statusRow);
        if (Session.account.expires > 0) {
            TextView expires = Ui.text(this, "Expires: " + DateFormat.getDateInstance().format(new Date(Session.account.expires * 1000)), 12, Ui.WHITE50, false);
            expires.setPadding(0, Ui.dp(this, 6), 0, 0);
            card.addView(expires);
        }
        card.setLayoutParams(Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(this, 12)));
        return card;
    }

    private void addNav(LinearLayout parent, String id, String icon, String label) {
        boolean compact = Ui.compact(this);
        LinearLayout item = new LinearLayout(this);
        item.setGravity(Gravity.CENTER_VERTICAL);
        item.setBackgroundResource(R.drawable.bg_nav_item);
        item.setFocusable(true);
        item.setClickable(true);
        int h = Ui.dp(this, compact ? 8 : 12), w = Ui.dp(this, 12);
        item.setPadding(w, h, w, h);
        TextView glyph = Ui.text(this, icon, compact ? 16 : 18, Ui.WHITE, false);
        glyph.setGravity(Gravity.CENTER);
        item.addView(glyph, new LinearLayout.LayoutParams(Ui.dp(this, 26), -2));
        TextView name = Ui.text(this, label, compact ? 14 : 15, Ui.WHITE70, false);
        name.setSingleLine(true);
        name.setEllipsize(TextUtils.TruncateAt.END);
        name.setPadding(Ui.dp(this, 10), 0, 0, 0);
        item.addView(name);
        item.setOnClickListener(v -> {
            if (id.equals("switch")) finish();
            else select(id);
        });
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = Ui.dp(this, 4);
        parent.addView(item, params);
        navItems.put(id, item);
    }

    private Page page(String id) {
        Page page = pages.get(id);
        if (page == null) {
            switch (id) {
                case "movies": page = new BrowsePage(this, true); break;
                case "series": page = new BrowsePage(this, false); break;
                case "favorites": page = new FavoritesPage(this); break;
                case "search": page = new SearchPage(this); break;
                case "settings": page = new SettingsPage(this); break;
                default: page = new LiveTvPage(this);
            }
            pages.put(id, page);
        }
        return page;
    }

    void select(String id) {
        overlayHost.removeAllViews();
        pageHost.setVisibility(View.VISIBLE);
        current = id;
        pageHost.removeAllViews();
        Page page = page(id);
        pageHost.addView(page.view(), new FrameLayout.LayoutParams(-1, -1));
        for (Map.Entry<String, LinearLayout> entry : navItems.entrySet()) {
            boolean on = entry.getKey().equals(id);
            entry.getValue().setSelected(on);
            ((TextView) entry.getValue().getChildAt(1)).setTextColor(on ? Ui.WHITE : Ui.WHITE70);
        }
        page.onShow();
    }

    /** Shows a detail screen on top of the current page. */
    void showOverlay(View view) {
        pageHost.setVisibility(View.GONE);
        view.setBackgroundResource(R.drawable.bg_app);
        overlayHost.addView(view, new FrameLayout.LayoutParams(-1, -1));
    }

    void closeOverlay() {
        int count = overlayHost.getChildCount();
        if (count > 0) overlayHost.removeViewAt(count - 1);
        if (overlayHost.getChildCount() == 0) pageHost.setVisibility(View.VISIBLE);
    }

    void openMovie(Media.Poster poster) { showOverlay(new MovieDetailView(this, poster)); }

    void openSeries(Media.Poster poster) { showOverlay(new SeriesDetailView(this, poster)); }

    @Override public void onBackPressed() {
        if (overlayHost.getChildCount() > 0) {
            closeOverlay();
            return;
        }
        Page page = pages.get(current);
        if (page != null && page.onBack()) return;
        if (!"live".equals(current)) {
            select("live");
            return;
        }
        super.onBackPressed();
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) PlayerActivity.immersive(this);
    }

    @Override protected void onResume() {
        super.onResume();
        refreshMini();
        // Watch progress changes while the player is open
        Page page = pages.get(current);
        if (page != null && overlayHost != null && overlayHost.getChildCount() == 0) page.onShow();
    }

    @Override protected void onStart() {
        super.onStart();
        Playback.addListener(playbackListener);
        refreshMini();
    }

    @Override protected void onStop() {
        Playback.removeListener(playbackListener);
        if (miniView != null) miniView.setPlayer(null);
        // Leaving the app pauses playback; opening the full-screen player must not
        if (!Playback.fullScreenVisible) Playback.pauseForBackground();
        super.onStop();
    }

    @Override protected void onDestroy() {
        if (isFinishing() && Session.profile != null) Playback.stop();
        super.onDestroy();
    }

    // ---- Mini player: keeps playing in the corner after leaving full screen ----

    private FrameLayout mini;
    private PlayerView miniView;
    private TextView miniTitle, miniStatus, miniMute, miniExpand, miniClose;
    private final Playback.Listener playbackListener = this::refreshMini;

    private void expandMini() {
        if (Playback.failed) Playback.retry();
        else PlayerActivity.open(this);
    }

    private boolean miniShowing() { return mini != null && mini.getVisibility() == View.VISIBLE; }

    // Remote shortcuts so the mini player never needs a long walk across the screen: Stop closes it, Menu jumps to it
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (miniShowing() && event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            int key = event.getKeyCode();
            if (key == KeyEvent.KEYCODE_MEDIA_STOP) {
                Playback.stop();
                return true;
            }
            if (key == KeyEvent.KEYCODE_MENU) {
                miniClose.requestFocus();
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private TextView miniButton(String label, String description, Runnable action) {
        TextView button = Ui.text(this, label, 14, Ui.WHITE, false);
        button.setGravity(Gravity.CENTER);
        button.setBackgroundResource(R.drawable.bg_star);
        button.setFocusable(true);
        button.setClickable(true);
        button.setContentDescription(description);
        button.setOnClickListener(v -> action.run());
        return button;
    }

    private void buildMini(FrameLayout root) {
        int width = Ui.dp(this, Ui.compact(this) ? 220 : 288);
        mini = new FrameLayout(this);
        mini.setBackgroundColor(0xFF000000);
        mini.setElevation(Ui.dp(this, 8));
        mini.setVisibility(View.GONE);
        Ui.roundClip(mini, 12);

        miniView = new PlayerView(this);
        miniView.setUseController(false);
        miniView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        mini.addView(miniView, new FrameLayout.LayoutParams(-1, -1));

        miniStatus = Ui.text(this, "", 12, Ui.WHITE, false);
        miniStatus.setGravity(Gravity.CENTER);
        miniStatus.setPadding(Ui.dp(this, 10), Ui.dp(this, 26), Ui.dp(this, 10), 0);
        mini.addView(miniStatus, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));

        // Tap the picture to go full screen, or to retry when the stream failed. Not a D-pad stop:
        // the buttons above do the same job and the remote would otherwise land here instead of on them.
        View tap = new View(this);
        tap.setClickable(true);
        tap.setBackgroundResource(R.drawable.bg_mini_border);
        tap.setContentDescription("Expand to full screen");
        tap.setOnClickListener(v -> expandMini());
        mini.addView(tap, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackground(new android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xCC000000, 0x00000000}));
        int pad = Ui.dp(this, 6);
        bar.setPadding(Ui.dp(this, 10), pad, pad, Ui.dp(this, 14));
        miniTitle = Ui.text(this, "", 12, Ui.WHITE, true);
        miniTitle.setSingleLine(true);
        miniTitle.setEllipsize(TextUtils.TruncateAt.END);
        bar.addView(miniTitle, new LinearLayout.LayoutParams(0, -2, 1));
        int size = Ui.dp(this, 36);
        LinearLayout.LayoutParams buttonParams = Ui.margins(new LinearLayout.LayoutParams(size, size), Ui.dp(this, 4), 0, 0, 0);
        miniMute = miniButton("🔊", "Mute", () -> Playback.setMuted(!Playback.muted));
        miniExpand = miniButton("⤢", "Expand to full screen", this::expandMini);
        miniClose = miniButton("✕", "Close the mini player", Playback::stop);
        bar.addView(miniMute, buttonParams);
        bar.addView(miniExpand, buttonParams);
        bar.addView(miniClose, buttonParams);
        mini.addView(bar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, Math.round(width * 9f / 16f), Gravity.BOTTOM | Gravity.END);
        int margin = Ui.dp(this, 8);
        params.setMargins(margin, margin, margin, margin);
        root.addView(mini, params);
    }

    private void refreshMini() {
        if (mini == null) return;
        boolean show = Playback.hasMedia() && !Playback.fullScreenVisible;
        mini.setVisibility(show ? View.VISIBLE : View.GONE);
        if (!show) {
            miniView.setPlayer(null);
            return;
        }
        if (miniView.getPlayer() != Playback.player()) miniView.setPlayer(Playback.player());
        miniTitle.setText(Playback.title());
        miniMute.setText(Playback.muted ? "🔇" : "🔊");
        miniMute.setContentDescription(Playback.muted ? "Unmute" : "Mute");
        miniStatus.setText(Playback.failed ? Playback.status + "\nTap to retry" : Playback.status);
        miniStatus.setVisibility(Playback.status.isEmpty() ? View.GONE : View.VISIBLE);
        Playback.resumeFromBackground();
    }
}
