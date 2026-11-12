package com.knackeredtv.android;

import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Searches every live channel, movie and series at once. */
final class SearchPage extends Page {
    private static final int LIMIT = 60;

    private EditText input;
    private CardGrid grid;
    private TextView hint, note;
    private boolean loadingLibrary;
    private int generation;

    SearchPage(HomeActivity home) { super(home); }

    @Override View build() {
        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        input = Ui.input(context, "Search channels, movies and series...", false);
        input.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            public void onTextChanged(CharSequence s, int a, int b, int c) { search(); }
            public void afterTextChanged(Editable s) {}
        });
        column.addView(input, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(context, 6)));
        note = Ui.text(context, "", 12, Ui.WHITE50, false);
        note.setPadding(Ui.dp(context, 4), 0, 0, Ui.dp(context, 6));
        column.addView(note);

        FrameLayout stage = new FrameLayout(context);
        stage.setBackgroundResource(R.drawable.bg_glass_panel);
        int pad = Ui.dp(context, 6);
        stage.setPadding(pad, pad, pad, pad);
        grid = new CardGrid(context, Ui.compact(context) ? 95 : 115);
        stage.addView(grid, new FrameLayout.LayoutParams(-1, -1));
        hint = Ui.message(context, "Type to search");
        stage.addView(hint, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
        column.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));
        return column;
    }

    @Override void onShow() {
        if (Session.isXtream() && (Session.allMovies == null || Session.allSeries == null)) loadLibrary();
        if (Session.live == null) loadChannels();
    }

    private void loadChannels() {
        Session.run(home, () -> {
            if (Session.isXtream()) {
                XtreamApi api = Session.api();
                if (Session.liveCategories == null) Session.liveCategories = api.categories("get_live_categories");
                return api.liveChannels(Session.liveCategories);
            }
            return PlaylistLoader.load(home, Session.profile);
        }, channels -> {
            if (Session.live == null) {
                Session.live = channels;
                if (Session.liveCategories == null) Session.liveCategories = PlaylistLoader.categories(channels);
            }
            search();
        }, null);
    }

    private void loadLibrary() {
        if (loadingLibrary) return;
        loadingLibrary = true;
        note.setText("Loading the full movie and series library so they can be searched...");
        Session.run(home, () -> {
            XtreamApi api = Session.api();
            List<Media.Poster> m = api.movies(null);
            List<Media.Poster> s = api.series(null);
            return new List[]{m, s};
        }, result -> {
            loadingLibrary = false;
            Session.allMovies = result[0];
            Session.allSeries = result[1];
            note.setText("");
            search();
        }, error -> {
            loadingLibrary = false;
            Session.allMovies = new ArrayList<>();
            Session.allSeries = new ArrayList<>();
            note.setText("Could not load movies and series for search. " + error);
        });
    }

    private void search() {
        String query = input.getText().toString().trim().toLowerCase(Locale.ROOT);
        int mine = ++generation;
        if (query.isEmpty()) {
            grid.setCards(new ArrayList<>());
            hint.setText("Type to search");
            hint.setVisibility(View.VISIBLE);
            return;
        }
        String[] words = query.split("\\s+");
        Session.post(() -> {
            List<Channel> channels = new ArrayList<>();
            List<Media.Poster> movies = new ArrayList<>(), series = new ArrayList<>();
            if (Session.live != null) for (Channel c : Session.live) if (matches(c.name, words)) channels.add(c);
            if (Session.allMovies != null) for (Media.Poster p : Session.allMovies) if (matches(p.name, words)) movies.add(p);
            if (Session.allSeries != null) for (Media.Poster p : Session.allSeries) if (matches(p.name, words)) series.add(p);
            rank(channels, movies, series, query);
            home.runOnUiThread(() -> {
                if (mine != generation || home.isFinishing()) return;
                show(channels, movies, series);
            });
        });
    }

    private static boolean matches(String name, String[] words) {
        String lower = name.toLowerCase(Locale.ROOT);
        for (String word : words) if (!lower.contains(word)) return false;
        return true;
    }

    // Names that start with the query come first
    private static void rank(List<Channel> channels, List<Media.Poster> movies, List<Media.Poster> series, String query) {
        java.util.Collections.sort(channels, (a, b) -> Boolean.compare(!a.name.toLowerCase(Locale.ROOT).startsWith(query), !b.name.toLowerCase(Locale.ROOT).startsWith(query)));
        java.util.Comparator<Media.Poster> byStart = (a, b) -> Boolean.compare(!a.name.toLowerCase(Locale.ROOT).startsWith(query), !b.name.toLowerCase(Locale.ROOT).startsWith(query));
        java.util.Collections.sort(movies, byStart);
        java.util.Collections.sort(series, byStart);
    }

    private void show(List<Channel> channels, List<Media.Poster> movies, List<Media.Poster> series) {
        List<Card> cards = new ArrayList<>();
        if (!channels.isEmpty()) {
            cards.add(Card.header("Live TV  (" + channels.size() + ")"));
            for (int i = 0; i < Math.min(LIMIT, channels.size()); i++) cards.add(channelCard(channels.get(i)));
        }
        addPosters(cards, "Movies", movies);
        addPosters(cards, "Series", series);
        grid.setCards(cards);
        hint.setText("Nothing found");
        hint.setVisibility(cards.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private void addPosters(List<Card> cards, String title, List<Media.Poster> list) {
        if (list.isEmpty()) return;
        cards.add(Card.header(title + "  (" + list.size() + ")"));
        for (int i = 0; i < Math.min(LIMIT, list.size()); i++) {
            Media.Poster poster = list.get(i);
            Card card = new Card(Card.POSTER);
            card.title = poster.name;
            card.image = poster.image;
            card.rating = poster.rating;
            card.favorite = Session.favorites.contains(poster.kind, poster.id);
            card.toggleFavorite = () -> Session.favorites.toggle(FavoritesStore.Fav.of(poster));
            card.click = () -> { if (poster.kind.equals("movie")) home.openMovie(poster); else home.openSeries(poster); };
            cards.add(card);
        }
    }

    private Card channelCard(Channel channel) {
        Card card = new Card(Card.LIVE);
        card.title = channel.name;
        card.subtitle = channel.category;
        card.image = channel.logo;
        card.favorite = Session.favorites.contains("live", channel.id);
        card.toggleFavorite = () -> Session.favorites.toggle(FavoritesStore.Fav.of(channel));
        card.click = () -> PlayerActivity.live(home, channel.name, channel.url, channel.fallbackUrl);
        return card;
    }
}
