package com.knackeredtv.android;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.text.DateFormat;
import java.util.Date;
import java.util.List;

final class SettingsPage extends Page {
    SettingsPage(HomeActivity home) { super(home); }

    private LinearLayout body;

    @Override View build() {
        ScrollView scroll = new ScrollView(context);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout panel = Ui.panel(context);
        int pad = Ui.dp(context, Ui.compact(context) ? 14 : 24);
        panel.setPadding(pad, pad, pad, pad);
        body = panel;
        scroll.addView(panel, new ScrollView.LayoutParams(-1, -2));
        return scroll;
    }

    @Override void onShow() {
        body.removeAllViews();
        Profile profile = Session.profile;
        body.addView(Ui.text(context, "Settings", Ui.compact(context) ? 20 : 24, Ui.WHITE, true));

        section("Profile Information");
        LinearLayout info = Ui.card(context);
        int pad = Ui.dp(context, 14);
        info.setPadding(pad, pad, pad, pad);
        row(info, "Profile Name:", profile.name);
        if (profile.isXtream()) {
            String host = Uri.parse(profile.location).getHost();
            row(info, "Server:", host == null ? profile.location : host);
            row(info, "Username:", profile.username);
            if (Session.account != null) {
                row(info, "Status:", Session.account.status);
                if (Session.account.expires > 0) {
                    row(info, "Expires:", DateFormat.getDateInstance().format(new Date(Session.account.expires * 1000)));
                }
                row(info, "Max connections:", String.valueOf(Session.account.maxConnections));
            }
        } else {
            row(info, "Source:", profile.type.equals("public") ? "Public playlist (iptv-org)" : "Private playlist");
        }
        body.addView(info, spaced());

        section("Library");
        LinearLayout library = Ui.card(context);
        library.setPadding(pad, pad, pad, pad);
        library.addView(Ui.glassButton(context, "Clear favorites", () -> confirm("Clear all favorites for this profile?", () -> {
            Session.favorites.clear();
            Toast.makeText(context, "Favorites cleared", Toast.LENGTH_SHORT).show();
        })));
        TextView history = Ui.glassButton(context, "Clear watch history", () -> confirm("Clear continue-watching progress?", () -> {
            Session.history.clear();
            Toast.makeText(context, "Watch history cleared", Toast.LENGTH_SHORT).show();
        }));
        library.addView(history, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(context, 8), 0, 0));
        body.addView(library, spaced());

        section("About");
        LinearLayout about = Ui.card(context);
        about.setPadding(pad, pad, pad, pad);
        row(about, "Version:", version());
        updateBox = new LinearLayout(context);
        updateBox.setOrientation(LinearLayout.VERTICAL);
        about.addView(updateBox);
        renderUpdates(null);
        if (UpdateChecker.last == null && !checking) checkUpdates();
        TextView note = Ui.text(context, "KnackeredTV does not provide any content. You need your own IPTV subscription and the legal right to access the streams you play.", 13, Ui.WHITE50, false);
        note.setPadding(0, Ui.dp(context, 8), 0, 0);
        about.addView(note);
        body.addView(about, spaced());

        TextView danger = Ui.text(context, "Danger Zone", 20, Ui.RED, true);
        danger.setPadding(0, Ui.dp(context, 20), 0, Ui.dp(context, 8));
        body.addView(danger);
        LinearLayout dangerCard = Ui.card(context);
        dangerCard.setPadding(pad, pad, pad, pad);
        dangerCard.addView(Ui.dangerButton(context, "Logout & Clear Profile", () -> confirm("Remove this profile and its favorites from this device?", this::removeProfile)));
        TextView warning = Ui.text(context, "This removes the current profile and its saved favorites and watch history.", 13, Ui.WHITE40, false);
        warning.setPadding(0, Ui.dp(context, 8), 0, 0);
        dangerCard.addView(warning);
        body.addView(dangerCard, spaced());
    }

    private LinearLayout.LayoutParams spaced() {
        return Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(context, 4));
    }

    private void section(String title) {
        TextView heading = Ui.text(context, title, 20, Ui.WHITE, true);
        heading.setPadding(0, Ui.dp(context, 20), 0, Ui.dp(context, 8));
        body.addView(heading);
    }

    private void row(LinearLayout parent, String label, String value) {
        LinearLayout line = new LinearLayout(context);
        line.setPadding(0, Ui.dp(context, 4), 0, Ui.dp(context, 4));
        line.addView(Ui.text(context, label, 14, Ui.WHITE60, false));
        TextView text = Ui.text(context, value, 14, Ui.WHITE, true);
        text.setGravity(Gravity.END);
        text.setSingleLine(true);
        text.setEllipsize(android.text.TextUtils.TruncateAt.END);
        line.addView(text, new LinearLayout.LayoutParams(0, -2, 1));
        parent.addView(line);
    }

    private String version() { return UpdateChecker.currentVersion(context); }

    private LinearLayout updateBox;
    private boolean checking;

    private void checkUpdates() {
        checking = true;
        renderUpdates(null);
        Session.run(home, () -> UpdateChecker.check(version()), result -> {
            checking = false;
            renderUpdates(null);
            home.showUpdateBadge();
        }, error -> {
            checking = false;
            renderUpdates(error);
        });
    }

    private void renderUpdates(String error) {
        updateBox.removeAllViews();
        UpdateChecker.Result result = UpdateChecker.last;
        boolean available = result != null && result.updateAvailable();
        String status = checking ? "Checking for updates…"
                : error != null ? "Could not check for updates: " + error
                : result == null ? ""
                : available ? "Update available: v" + result.latest
                : "You're up to date";
        if (!status.isEmpty()) {
            TextView line = Ui.text(context, status, 14, error != null ? Ui.RED : available ? Ui.GREEN : Ui.WHITE60, available);
            line.setPadding(0, Ui.dp(context, 6), 0, Ui.dp(context, 8));
            updateBox.addView(line);
        }

        LinearLayout buttons = new LinearLayout(context);
        buttons.addView(Ui.glassButton(context, checking ? "Checking…" : "Check for updates", () -> {
            if (!checking) checkUpdates();
        }));
        if (available && !checking) {
            TextView download = Ui.primaryButton(context, "Download v" + result.latest, () -> openUrl(result.newer.get(0).url));
            buttons.addView(download, Ui.margins(new LinearLayout.LayoutParams(-2, -2), Ui.dp(context, 8), 0, 0, 0));
        }
        updateBox.addView(buttons);

        if (result == null) return;
        List<UpdateChecker.Release> shown = new java.util.ArrayList<>(result.newer);
        if (!available && result.currentRelease != null) shown.add(result.currentRelease);
        for (UpdateChecker.Release release : shown) addChangeLog(release, available);
    }

    private void addChangeLog(UpdateChecker.Release release, boolean isUpdate) {
        TextView title = Ui.text(context, (isUpdate ? "" : "What's new in ") + release.name, 15, Ui.WHITE, true);
        title.setPadding(0, Ui.dp(context, 14), 0, Ui.dp(context, 4));
        updateBox.addView(title);
        if (release.notes.isEmpty()) {
            updateBox.addView(Ui.text(context, "No release notes.", 13, Ui.WHITE40, false));
            return;
        }
        StringBuilder text = new StringBuilder();
        for (String line : release.notes.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            if (text.length() > 0) text.append('\n');
            if (trimmed.startsWith("#")) text.append(trimmed.replaceFirst("^#+\\s*", ""));
            else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) text.append("•  ").append(trimmed.substring(2));
            else text.append(trimmed);
        }
        updateBox.addView(Ui.text(context, text.toString(), 13, Ui.WHITE70, false));
    }

    private void openUrl(String url) {
        String target = url != null && url.startsWith("https://github.com/") ? url : UpdateChecker.RELEASES_PAGE;
        try {
            context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target)));
        } catch (Exception e) {
            Toast.makeText(context, "No browser available. Get the update from " + UpdateChecker.RELEASES_PAGE, Toast.LENGTH_LONG).show();
        }
    }

    private void confirm(String message, Runnable action) {
        new AlertDialog.Builder(context).setMessage(message)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Confirm", (d, w) -> action.run()).show();
    }

    private void removeProfile() {
        try {
            ProfileStore store = new ProfileStore(context);
            List<Profile> profiles = store.load();
            java.util.Iterator<Profile> iterator = profiles.iterator();
            while (iterator.hasNext()) if (iterator.next().id.equals(Session.profile.id)) iterator.remove();
            store.save(profiles);
            FavoritesStore.forget(context, Session.profile.id);
            HistoryStore.forget(context, Session.profile.id);
            home.startActivity(new Intent(home, LoginActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));
            home.finish();
        } catch (Exception e) {
            Toast.makeText(context, "Could not remove the profile", Toast.LENGTH_LONG).show();
        }
    }
}
