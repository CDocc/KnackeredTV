package com.knackeredtv.android;

import android.content.Context;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.bumptech.glide.Glide;
import java.util.List;

final class SeriesDetailView extends DetailView {
    private final Media.Poster series;
    private Media.SeriesInfo info;
    private int season = -1;
    private LinearLayout seasonRow, episodeList;
    private LinearLayout episodePanel;

    SeriesDetailView(HomeActivity home, Media.Poster series) {
        super(home, series.name, series.image);
        this.series = series;
        meta.setText(joinMeta(series.rating, series.year, "", series.genre));
        if (!series.plot.isEmpty()) details.addView(body(series.plot, Ui.WHITE80));
        refreshProgress();
        TextView loading = Ui.text(getContext(), "Loading episodes...", 14, Ui.WHITE60, false);
        loading.setGravity(Gravity.CENTER);
        loading.setPadding(0, Ui.dp(getContext(), 24), 0, Ui.dp(getContext(), 24));
        content.addView(loading, new LinearLayout.LayoutParams(-1, -2));
        Session.run(home, () -> Session.api().seriesInfo(series.id), loaded -> {
            content.removeView(loading);
            info = loaded;
            if (!loaded.poster.isEmpty()) setPoster(loaded.poster);
            meta.setText(joinMeta(loaded.rating > 0 ? loaded.rating : series.rating, loaded.year.isEmpty() ? series.year : loaded.year, "", loaded.genre.isEmpty() ? series.genre : loaded.genre));
            details.removeAllViews();
            details.addView(body(!loaded.plot.isEmpty() ? loaded.plot : series.plot.isEmpty() ? "No description available." : series.plot, Ui.WHITE80));
            if (!loaded.cast.isEmpty()) details.addView(labeled("Cast:", loaded.cast));
            showEpisodes();
            refreshProgress();
        }, error -> {
            loading.setText(error);
            loading.setTextColor(0xFFFECACA);
        });
    }

    private HistoryStore.Entry continueEntry() {
        for (HistoryStore.Entry entry : Session.history.list("episode")) {
            if (entry.seriesId.equals(series.id) && entry.resumable()) return entry;
        }
        return null;
    }

    private void showEpisodes() {
        Context c = getContext();
        if (info.seasons.isEmpty()) {
            TextView none = Ui.message(c, "No episodes available");
            none.setPadding(0, Ui.dp(c, 24), 0, 0);
            content.addView(none);
            return;
        }
        HistoryStore.Entry resume = continueEntry();
        season = resume != null && info.seasons.contains(resume.season) ? resume.season : info.seasons.get(0);

        episodePanel = Ui.panel(c);
        int pad = Ui.dp(c, Ui.compact(c) ? 10 : 18);
        episodePanel.setPadding(pad, pad, pad, pad);
        HorizontalScrollView seasonScroll = new HorizontalScrollView(c);
        seasonScroll.setHorizontalScrollBarEnabled(false);
        seasonRow = new LinearLayout(c);
        seasonScroll.addView(seasonRow);
        episodePanel.addView(seasonScroll, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(c, 10)));
        episodeList = new LinearLayout(c);
        episodeList.setOrientation(LinearLayout.VERTICAL);
        episodePanel.addView(episodeList);
        content.addView(episodePanel, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, Ui.dp(c, 12), 0, 0));
        drawSeasons();
        drawEpisodes();
    }

    private void drawSeasons() {
        Context c = getContext();
        seasonRow.removeAllViews();
        for (int s : info.seasons) {
            TextView chip = Ui.glassButton(c, "Season " + s, () -> {
                season = s;
                drawSeasons();
                drawEpisodes();
            });
            chip.setSelected(s == season);
            seasonRow.addView(chip, gap());
        }
    }

    private void drawEpisodes() {
        Context c = getContext();
        episodeList.removeAllViews();
        List<Media.Episode> episodes = info.episodes.get(season);
        if (episodes == null) return;
        for (Media.Episode episode : episodes) {
            HistoryStore.Entry saved = Session.history.get("episode", episode.id);
            boolean resumable = saved != null && saved.resumable();

            LinearLayout row = new LinearLayout(c);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setBackgroundResource(R.drawable.bg_card);
            row.setFocusable(true);
            row.setClickable(true);
            int pad = Ui.dp(c, 8);
            row.setPadding(pad, pad, pad, pad);

            Ui.AspectFrame thumb = new Ui.AspectFrame(c, 0.5625f);
            thumb.setBackgroundResource(R.drawable.bg_poster_placeholder);
            Ui.roundClip(thumb, 8);
            ImageView image = new ImageView(c);
            image.setScaleType(ImageView.ScaleType.CENTER_CROP);
            thumb.addView(image, new FrameLayout.LayoutParams(-1, -1));
            String art = episode.image.isEmpty() ? series.image : episode.image;
            if (!art.isEmpty()) Glide.with(image).load(art).override(320, 180).centerCrop().into(image);
            row.addView(thumb, new LinearLayout.LayoutParams(Ui.dp(c, Ui.compact(c) ? 100 : 140), -2));

            LinearLayout text = new LinearLayout(c);
            text.setOrientation(LinearLayout.VERTICAL);
            TextView name = Ui.text(c, episode.episode + ". " + episode.title, 15, Ui.WHITE, true);
            name.setSingleLine(true);
            name.setEllipsize(TextUtils.TruncateAt.END);
            text.addView(name);
            String sub = episode.duration + (resumable ? (episode.duration.isEmpty() ? "" : "  ·  ") + "Resume " + HistoryStore.formatTime(saved.position) : "");
            if (!sub.isEmpty()) text.addView(Ui.text(c, sub, 12, resumable ? Ui.BLUE : Ui.WHITE40, false));
            row.addView(text, Ui.margins(new LinearLayout.LayoutParams(0, -2, 1), Ui.dp(c, 12), 0, 0, 0));
            row.setOnClickListener((View v) -> play(episode, resumable ? saved.position : 0));
            episodeList.addView(row, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(c, 8)));
        }
    }

    private String label(Media.Episode e) {
        return String.format(java.util.Locale.ROOT, "%s · S%02dE%02d · %s", series.name, e.season, e.episode, e.title);
    }

    private void play(Media.Episode episode, long start) {
        String title = label(episode);
        String image = episode.image.isEmpty() ? series.image : episode.image;
        HistoryStore.Entry meta = new HistoryStore.Entry("episode", episode.id, title, image, episode.ext, series.id,
                episode.season, episode.episode, 0, 0, System.currentTimeMillis());
        PlayerActivity.vod(getContext(), title, Session.api().episodeUrl(episode.id, episode.ext), meta, start);
    }

    @Override protected void refreshProgress() {
        buttons.removeAllViews();
        HistoryStore.Entry resume = continueEntry();
        if (resume != null) {
            buttons.addView(Ui.primaryButton(getContext(), String.format(java.util.Locale.ROOT, "▶  Continue S%02dE%02d · %s",
                    resume.season, resume.episode, HistoryStore.formatTime(resume.position)), () -> {
                String url = Session.api().episodeUrl(resume.id, resume.ext);
                PlayerActivity.vod(getContext(), resume.title, url, resume, resume.position);
            }), gap());
        }
        boolean favorite = Session.favorites.contains("series", series.id);
        TextView star = Ui.glassButton(getContext(), favorite ? "★  Favorite" : "☆  Favorite", () -> {});
        star.setOnClickListener((View v) -> {
            boolean now = Session.favorites.toggle(FavoritesStore.Fav.of(series));
            star.setText(now ? "★  Favorite" : "☆  Favorite");
        });
        buttons.addView(star);
        if (info != null && episodeList != null) drawEpisodes();
    }
}
