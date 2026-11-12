package com.knackeredtv.android;

import android.content.Context;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.bumptech.glide.Glide;

/** Shared layout of the movie and series detail pages: back button, poster and a text column. */
abstract class DetailView extends FrameLayout {
    protected final HomeActivity home;
    protected final LinearLayout content;
    protected final TextView title, meta;
    protected final LinearLayout buttons, details;
    private final ImageView poster;

    DetailView(HomeActivity home, String name, String imageUrl) {
        super(home);
        this.home = home;
        Context c = home;
        boolean compact = Ui.compact(c);
        ScrollView scroll = new ScrollView(c);
        scroll.setVerticalScrollBarEnabled(false);
        addView(scroll, new LayoutParams(-1, -1));
        content = new LinearLayout(c);
        content.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2));

        content.addView(Ui.glassButton(c, "←  Back", home::closeOverlay),
                Ui.margins(new LinearLayout.LayoutParams(-2, -2), 0, 0, 0, Ui.dp(c, 10)));

        LinearLayout hero = Ui.panel(c);
        hero.setOrientation(LinearLayout.HORIZONTAL);
        int pad = Ui.dp(c, compact ? 12 : 24);
        hero.setPadding(pad, pad, pad, pad);
        Ui.AspectFrame frame = new Ui.AspectFrame(c, 1.5f);
        frame.setBackgroundResource(R.drawable.bg_poster_placeholder);
        Ui.roundClip(frame, 12);
        poster = new ImageView(c);
        poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
        frame.addView(poster, new FrameLayout.LayoutParams(-1, -1));
        hero.addView(frame, new LinearLayout.LayoutParams(Ui.dp(c, compact ? 120 : 190), -2));
        setPoster(imageUrl);

        LinearLayout column = new LinearLayout(c);
        column.setOrientation(LinearLayout.VERTICAL);
        hero.addView(column, Ui.margins(new LinearLayout.LayoutParams(0, -2, 1), Ui.dp(c, compact ? 14 : 24), 0, 0, 0));
        title = Ui.gradientTitle(c, name, compact ? 22 : 30);
        column.addView(title);
        meta = Ui.text(c, "", 13, Ui.WHITE60, false);
        meta.setPadding(0, Ui.dp(c, 6), 0, Ui.dp(c, 10));
        column.addView(meta);
        buttons = new LinearLayout(c);
        column.addView(buttons, Ui.margins(new LinearLayout.LayoutParams(-2, -2), 0, 0, 0, Ui.dp(c, 12)));
        details = new LinearLayout(c);
        details.setOrientation(LinearLayout.VERTICAL);
        column.addView(details);
        content.addView(hero, new LinearLayout.LayoutParams(-1, -2));
        int outer = Ui.dp(c, 4);
        content.setPadding(outer, outer, outer, outer);
    }

    protected void setPoster(String url) {
        if (url == null || url.isEmpty()) return;
        Glide.with(poster).load(url).override(380, 570).centerCrop().into(poster);
    }

    protected TextView body(String text, int color) {
        TextView view = Ui.text(getContext(), text, 14, color, false);
        view.setLineSpacing(0, 1.15f);
        view.setPadding(0, 0, 0, Ui.dp(getContext(), 8));
        return view;
    }

    protected TextView labeled(String label, String value) {
        TextView view = Ui.text(getContext(), label + " " + value, 13, Ui.WHITE60, false);
        view.setPadding(0, 0, 0, Ui.dp(getContext(), 4));
        return view;
    }

    protected LinearLayout.LayoutParams gap() {
        return Ui.margins(new LinearLayout.LayoutParams(-2, -2), 0, 0, Ui.dp(getContext(), 10), 0);
    }

    protected static String joinMeta(double rating, String year, String extra, String genre) {
        StringBuilder out = new StringBuilder();
        if (rating > 0) out.append(String.format(java.util.Locale.ROOT, "★ %.1f", rating));
        for (String part : new String[]{year != null && year.length() >= 4 ? year.substring(0, 4) : "", extra, genre}) {
            if (part == null || part.isEmpty()) continue;
            if (out.length() > 0) out.append("   ·   ");
            out.append(part);
        }
        return out.toString();
    }

    /** Refreshes resume buttons after the player closes. */
    protected abstract void refreshProgress();

    @Override public void onWindowFocusChanged(boolean hasWindowFocus) {
        super.onWindowFocusChanged(hasWindowFocus);
        if (hasWindowFocus) refreshProgress();
    }

    protected View spacer(int dp) {
        View view = new View(getContext());
        view.setLayoutParams(new LinearLayout.LayoutParams(1, Ui.dp(getContext(), dp)));
        return view;
    }
}
