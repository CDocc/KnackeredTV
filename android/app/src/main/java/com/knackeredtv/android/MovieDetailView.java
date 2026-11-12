package com.knackeredtv.android;

import android.view.View;
import android.widget.TextView;

final class MovieDetailView extends DetailView {
    private final Media.Poster movie;
    private Media.MovieInfo info;

    MovieDetailView(HomeActivity home, Media.Poster movie) {
        super(home, movie.name, movie.image);
        this.movie = movie;
        meta.setText(joinMeta(movie.rating, "", "", ""));
        refreshProgress();
        details.addView(Ui.text(getContext(), "Loading details...", 14, Ui.WHITE40, false));
        Session.run(home, () -> Session.api().movieInfo(movie.id), loaded -> {
            info = loaded;
            if (!loaded.poster.isEmpty()) setPoster(loaded.poster);
            meta.setText(joinMeta(loaded.rating > 0 ? loaded.rating : movie.rating, loaded.year, loaded.duration, loaded.genre));
            details.removeAllViews();
            details.addView(body(loaded.plot.isEmpty() ? "No description available." : loaded.plot, Ui.WHITE80));
            if (!loaded.director.isEmpty()) details.addView(labeled("Director:", loaded.director));
            if (!loaded.cast.isEmpty()) details.addView(labeled("Cast:", loaded.cast));
        }, error -> {
            details.removeAllViews();
            details.addView(body("Could not load the details. You can still play the movie.", Ui.WHITE40));
        });
    }

    private String ext() {
        String ext = info != null ? info.ext : movie.ext;
        return ext == null || ext.isEmpty() ? "mp4" : ext;
    }

    private void play(long start) {
        String url = Session.api().movieUrl(movie.id, ext());
        HistoryStore.Entry meta = new HistoryStore.Entry("movie", movie.id, movie.name, movie.image, ext(), "", 0, 0, 0, 0, System.currentTimeMillis());
        PlayerActivity.vod(getContext(), movie.name, url, meta, start);
    }

    @Override protected void refreshProgress() {
        buttons.removeAllViews();
        HistoryStore.Entry saved = Session.history.get("movie", movie.id);
        if (saved != null && saved.resumable()) {
            buttons.addView(Ui.primaryButton(getContext(), "▶  Resume from " + HistoryStore.formatTime(saved.position), () -> play(saved.position)), gap());
            buttons.addView(Ui.glassButton(getContext(), "Start over", () -> play(0)), gap());
        } else {
            buttons.addView(Ui.primaryButton(getContext(), "▶  Play", () -> play(0)), gap());
        }
        boolean favorite = Session.favorites.contains("movie", movie.id);
        TextView star = Ui.glassButton(getContext(), favorite ? "★  Favorite" : "☆  Favorite", () -> {});
        star.setOnClickListener((View v) -> {
            boolean now = Session.favorites.toggle(FavoritesStore.Fav.of(movie));
            star.setText(now ? "★  Favorite" : "☆  Favorite");
        });
        buttons.addView(star);
    }
}
