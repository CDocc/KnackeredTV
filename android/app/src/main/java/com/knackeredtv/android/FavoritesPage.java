package com.knackeredtv.android;

import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;

/** Starred channels, movies and series, split into sections like the desktop Favorites page. */
final class FavoritesPage extends Page {
    private CardGrid grid;
    private FrameLayout stage;
    private TextView empty;

    FavoritesPage(HomeActivity home) { super(home); }

    @Override View build() {
        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        TextView title = Ui.text(context, "Favorites", Ui.compact(context) ? 20 : 24, Ui.WHITE, true);
        title.setPadding(Ui.dp(context, 4), 0, 0, Ui.dp(context, 10));
        column.addView(title);

        stage = new FrameLayout(context);
        stage.setBackgroundResource(R.drawable.bg_glass_panel);
        int pad = Ui.dp(context, 6);
        stage.setPadding(pad, pad, pad, pad);
        grid = new CardGrid(context, Ui.compact(context) ? 95 : 115);
        stage.addView(grid, new FrameLayout.LayoutParams(-1, -1));
        empty = Ui.message(context, "No favorites yet. Tap ☆ on a channel, movie or series to add it here.");
        empty.setPadding(Ui.dp(context, 24), 0, Ui.dp(context, 24), 0);
        stage.addView(empty, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        column.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));
        return column;
    }

    @Override void onShow() {
        List<Card> cards = new ArrayList<>();
        addSection(cards, "Live TV", "live");
        if (Session.isXtream()) {
            addSection(cards, "Movies", "movie");
            addSection(cards, "Series", "series");
        }
        grid.setCards(cards);
        empty.setVisibility(cards.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private void addSection(List<Card> cards, String heading, String kind) {
        List<FavoritesStore.Fav> favs = Session.favorites.list(kind);
        if (favs.isEmpty()) return;
        cards.add(Card.header(heading + "  (" + favs.size() + ")"));
        for (FavoritesStore.Fav fav : favs) {
            Card card = new Card(kind.equals("live") ? Card.LIVE : Card.POSTER);
            card.title = fav.name;
            card.image = fav.image;
            card.rating = fav.rating;
            card.favorite = true;
            card.toggleFavorite = () -> Session.favorites.toggle(fav);
            card.click = () -> open(fav);
            cards.add(card);
        }
    }

    private void open(FavoritesStore.Fav fav) {
        if (fav.kind.equals("live")) {
            PlayerActivity.live(home, fav.name, fav.url, fav.fallback);
            return;
        }
        Media.Poster poster = new Media.Poster(fav.kind, fav.id, fav.name, fav.image, fav.ext, "", "", "", fav.rating, 0);
        if (fav.kind.equals("movie")) home.openMovie(poster); else home.openSeries(poster);
    }
}
