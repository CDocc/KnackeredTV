package com.knackeredtv.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;

public final class LoginActivity extends Activity {
    private static final int PICK_PLAYLIST = 10;
    private static final String[] PUBLIC_LABELS = {"All channels (worldwide)", "Grouped by category", "Grouped by country", "Grouped by language"};
    private static final String[] PUBLIC_URLS = {
            "https://iptv-org.github.io/iptv/index.m3u",
            "https://iptv-org.github.io/iptv/index.category.m3u",
            "https://iptv-org.github.io/iptv/index.country.m3u",
            "https://iptv-org.github.io/iptv/index.language.m3u"
    };

    private ProfileStore store;
    private List<Profile> profiles = new ArrayList<>();
    private LinearLayout panel;
    private String screen = "profiles";
    private String source = "xtream";
    private int publicIndex;
    private int token;
    private EditText nameField, addressField, userField, passField;
    private String draftName = "", draftAddress = "", draftUser = "", draftPass = "";
    private String loadError;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        Ui.allowCutout(this);
        store = new ProfileStore(this);
        buildFrame();
        loadProfiles();
        if (profiles.isEmpty()) showForm(); else showProfiles();
    }

    @Override protected void onResume() {
        super.onResume();
        if (screen.equals("profiles")) {
            loadProfiles();
            showProfiles();
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) PlayerActivity.immersive(this);
    }

    private void loadProfiles() {
        try {
            profiles = store.load();
            loadError = null;
        } catch (Exception e) {
            profiles = new ArrayList<>();
            loadError = "Saved profiles could not be read. Check the device's security settings and restart the app.";
        }
    }

    private void buildFrame() {
        boolean compact = Ui.compact(this);
        FrameLayout root = new FrameLayout(this);
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER);
        root.addView(row, new FrameLayout.LayoutParams(-1, -1));
        Ui.applyInsets(root, Ui.dp(this, 16));

        if (Ui.widthDp(this) >= 640) {
            LinearLayout brand = new LinearLayout(this);
            brand.setOrientation(LinearLayout.VERTICAL);
            brand.setGravity(Gravity.CENTER);
            ImageView logo = new ImageView(this);
            logo.setImageResource(R.drawable.kn_logo);
            int size = Ui.dp(this, compact ? 110 : 170);
            brand.addView(logo, new LinearLayout.LayoutParams(size, size));
            TextView title = Ui.gradientTitle(this, "KnackeredTV", compact ? 30 : 40);
            title.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 4));
            brand.addView(title);
            brand.addView(Ui.text(this, "Modern IPTV Player", 15, Ui.WHITE60, false));
            row.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
        }

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        panel = Ui.panel(this);
        int pad = Ui.dp(this, compact ? 16 : 28);
        panel.setPadding(pad, pad, pad, pad);
        FrameLayout center = new FrameLayout(this);
        center.addView(panel, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER_VERTICAL));
        scroll.addView(center, new ScrollView.LayoutParams(-1, -1));
        int width = Ui.widthDp(this) >= 640 ? Math.min(440, Ui.widthDp(this) / 2) : Math.min(440, Ui.widthDp(this) - 32);
        row.addView(scroll, Ui.margins(new LinearLayout.LayoutParams(Ui.dp(this, width), -1), Ui.dp(this, 16), 0, Ui.dp(this, 16), 0));
        setContentView(root);
    }

    private TextView heading(String text) {
        TextView view = Ui.text(this, text, 20, Ui.WHITE, true);
        view.setPadding(0, 0, 0, Ui.dp(this, Ui.compact(this) ? 8 : 14));
        return view;
    }

    private void showProfiles() {
        screen = "profiles";
        token++;
        panel.removeAllViews();
        panel.addView(heading("Select Profile"));
        if (loadError != null) panel.addView(Ui.errorBox(this, loadError));
        for (Profile profile : profiles) {
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            LinearLayout card = Ui.card(this);
            card.setFocusable(true);
            card.setClickable(true);
            card.setBackgroundResource(R.drawable.bg_glass_button);
            int pad = Ui.dp(this, 12);
            card.setPadding(pad, pad, pad, pad);
            TextView name = Ui.text(this, profile.name, 16, Ui.WHITE, true);
            name.setSingleLine(true);
            name.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(name);
            card.addView(Ui.text(this, profile.isXtream() ? profile.username : profile.type.equals("public") ? "Public playlist" : "M3U playlist", 13, Ui.WHITE50, false));
            card.setOnClickListener(v -> connect(profile, false));
            row.addView(card, new LinearLayout.LayoutParams(0, -2, 1));
            TextView remove = Ui.glassButton(this, "✕", () -> confirmRemove(profile));
            remove.setContentDescription("Remove " + profile.name);
            row.addView(remove, Ui.margins(new LinearLayout.LayoutParams(-2, -1), Ui.dp(this, 8), 0, 0, 0));
            panel.addView(row, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(this, 10)));
        }
        panel.addView(Ui.glassButton(this, "Add New Profile", () -> {
            source = "xtream";
            draftName = draftAddress = draftUser = draftPass = "";
            showForm();
        }), Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(this, 4), 0, 0));
        footer();
    }

    private void footer() {
        TextView footer = Ui.text(this, "Xtream Codes API & M3U compatible", 12, Ui.WHITE40, false);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, Ui.dp(this, 18), 0, 0);
        panel.addView(footer, new LinearLayout.LayoutParams(-1, -2));
    }

    private TextView label(String text) {
        TextView view = Ui.text(this, text, 14, Ui.WHITE, false);
        view.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        view.setPadding(0, Ui.dp(this, Ui.compact(this) ? 4 : 8), 0, Ui.dp(this, Ui.compact(this) ? 4 : 6));
        return view;
    }

    private void keepDraft() {
        if (nameField != null) draftName = nameField.getText().toString();
        if (addressField != null) draftAddress = addressField.getText().toString();
        if (userField != null) draftUser = userField.getText().toString();
        if (passField != null) draftPass = passField.getText().toString();
    }

    private void showForm() { showForm(null); }

    private void showForm(String error) {
        screen = "form";
        token++;
        panel.removeAllViews();
        panel.addView(heading("Add New Profile"));

        LinearLayout tabs = new LinearLayout(this);
        String[][] tabList = {{"xtream", "Xtream login"}, {"public", "Public playlist"}, {"private", "My playlist"}};
        for (String[] tab : tabList) {
            TextView button = Ui.glassButton(this, tab[1], () -> {
                keepDraft();
                source = tab[0];
                showForm();
            });
            button.setSelected(source.equals(tab[0]));
            button.setTextSize(13);
            int pad = Ui.dp(this, 8);
            button.setPadding(pad, Ui.dp(this, 9), pad, Ui.dp(this, 9));
            tabs.addView(button, Ui.margins(new LinearLayout.LayoutParams(0, -2, 1), 0, 0, Ui.dp(this, 6), 0));
        }
        panel.addView(tabs, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(this, 6)));

        nameField = Ui.input(this, "My IPTV Profile", false);
        nameField.setText(draftName);
        addressField = userField = passField = null;
        panel.addView(label("Profile Name"));
        panel.addView(nameField);

        if (source.equals("xtream")) {
            addressField = Ui.input(this, "https://example.com:8080", false);
            addressField.setText(draftAddress);
            userField = Ui.input(this, "username", false);
            userField.setText(draftUser);
            passField = Ui.input(this, "••••••••", true);
            passField.setText(draftPass);
            panel.addView(label("Server URL"));
            panel.addView(addressField);
            panel.addView(label("Username"));
            panel.addView(userField);
            panel.addView(label("Password"));
            panel.addView(passField);
        } else if (source.equals("public")) {
            panel.addView(label("iptv-org free channels"));
            for (int i = 0; i < PUBLIC_LABELS.length; i++) {
                int index = i;
                TextView option = Ui.glassButton(this, PUBLIC_LABELS[i], () -> {
                    keepDraft();
                    publicIndex = index;
                    showForm();
                });
                option.setSelected(publicIndex == i);
                option.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                panel.addView(option, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(this, 6)));
            }
            TextView note = Ui.text(this, "Free, publicly available channels from the iptv-org project. Some streams may be offline or geo-blocked.", 12, Ui.WHITE40, false);
            panel.addView(note);
        } else {
            addressField = Ui.input(this, "https://example.com/playlist.m3u", false);
            addressField.setText(draftAddress);
            panel.addView(label("Playlist URL or file"));
            panel.addView(addressField);
            panel.addView(Ui.glassButton(this, "Choose a local .m3u file", () -> {
                keepDraft();
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                startActivityForResult(picker, PICK_PLAYLIST);
            }), Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(this, 8), 0, 0));
            TextView note = Ui.text(this, "Stored only on this device. Links that contain a login or token are never logged.", 12, Ui.WHITE40, false);
            note.setPadding(0, Ui.dp(this, 8), 0, 0);
            panel.addView(note);
        }

        if (error != null) {
            panel.addView(Ui.errorBox(this, error), Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(this, 12), 0, 0));
        }
        panel.addView(Ui.primaryButton(this, source.equals("xtream") ? "Login" : "Load playlist", this::submit),
                Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(this, 16), 0, Ui.dp(this, 6)));
        if (!profiles.isEmpty()) {
            TextView back = Ui.text(this, "← Back to Profiles", 14, Ui.WHITE60, false);
            back.setGravity(Gravity.CENTER);
            back.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 6));
            back.setFocusable(true);
            back.setClickable(true);
            back.setBackgroundResource(R.drawable.bg_nav_item);
            back.setOnClickListener(v -> showProfiles());
            panel.addView(back, new LinearLayout.LayoutParams(-1, -2));
        }
        footer();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_PLAYLIST && resultCode == RESULT_OK && data != null && data.getData() != null) {
            try {
                getContentResolver().takePersistableUriPermission(data.getData(), Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // Some providers only grant access for this session; the playlist will still load now.
            }
            draftAddress = data.getData().toString();
            showForm();
        }
    }

    private void submit() {
        keepDraft();
        String name = draftName.trim();
        String location = source.equals("public") ? PUBLIC_URLS[publicIndex] : draftAddress.trim();
        if (name.isEmpty()) { showForm("Profile name is required"); return; }
        if (source.equals("xtream")) {
            if (location.isEmpty()) { showForm("Server URL is required"); return; }
            if (draftUser.trim().isEmpty()) { showForm("Username is required"); return; }
            if (draftPass.isEmpty()) { showForm("Password is required"); return; }
        } else if (location.isEmpty()) {
            showForm("Playlist URL or file is required");
            return;
        }
        String scheme = Uri.parse(location).getScheme();
        boolean web = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        if (!web && !(source.equals("private") && "content".equalsIgnoreCase(scheme))) {
            showForm("Enter an address that starts with http:// or https://");
            return;
        }
        connect(Profile.create(name, source, location, source.equals("xtream") ? draftUser.trim() : "", source.equals("xtream") ? draftPass : ""), true);
    }

    private void confirmRemove(Profile profile) {
        new AlertDialog.Builder(this).setTitle("Remove " + profile.name + "?")
                .setMessage("This also removes its favorites and watch history on this device.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Remove", (d, w) -> {
                    List<Profile> next = new ArrayList<>(profiles);
                    next.remove(profile);
                    try {
                        store.save(next);
                        profiles = next;
                        FavoritesStore.forget(this, profile.id);
                        HistoryStore.forget(this, profile.id);
                        if (profiles.isEmpty()) showForm(); else showProfiles();
                    } catch (Exception e) {
                        loadError = "Could not remove the profile.";
                        showProfiles();
                    }
                }).show();
    }

    private static final class Result {
        Media.Account account;
        List<Channel> channels;
    }

    private void connect(Profile profile, boolean save) {
        int mine = ++token;
        screen = "connecting";
        panel.removeAllViews();
        panel.addView(heading("Connecting to " + profile.name + "…"));
        LinearLayout loading = Ui.loading(this, profile.isXtream() ? "Signing in..." : "Downloading playlist...");
        panel.addView(loading, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(this, 8), 0, Ui.dp(this, 16)));
        panel.addView(Ui.glassButton(this, "Cancel", () -> {
            token++;
            if (profiles.isEmpty()) showForm(); else showProfiles();
        }));

        Session.run(this, () -> {
            Result result = new Result();
            if (profile.isXtream()) result.account = new XtreamApi(profile).authenticate();
            else result.channels = PlaylistLoader.load(this, profile);
            return result;
        }, result -> {
            if (mine != token) return;
            if (save) {
                List<Profile> next = new ArrayList<>(profiles);
                next.add(profile);
                try {
                    store.save(next);
                    profiles = next;
                } catch (Exception e) {
                    showForm("Could not save the profile on this device.");
                    return;
                }
            }
            Session.start(this, profile, result.account, result.channels);
            screen = "profiles";
            startActivity(new Intent(this, HomeActivity.class));
        }, error -> {
            if (mine != token) return;
            if (save) {
                showForm(error);
            } else {
                loadError = error;
                showProfiles();
                loadError = null;
            }
        });
    }

    @Override public void onBackPressed() {
        if (screen.equals("form") && !profiles.isEmpty()) {
            showProfiles();
            return;
        }
        if (screen.equals("connecting")) {
            token++;
            if (profiles.isEmpty()) showForm(); else showProfiles();
            return;
        }
        super.onBackPressed();
    }
}
