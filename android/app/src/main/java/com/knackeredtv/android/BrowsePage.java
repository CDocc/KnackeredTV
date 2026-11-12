package com.knackeredtv.android;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/** Movies or Series: categories, search, sort, reload, "continue watching" and a poster grid. */
final class BrowsePage extends Page {
    private static final String[] SORT_LABELS = {"Provider order", "A → Z", "Z → A", "Top rated", "Recently added"};

    private final boolean movies;
    private CategoryPanel categoryPanel;
    private CardGrid grid;
    private EditText search;
    private TextView sortButton;
    private FrameLayout stage;
    private View statusView;
    private String categoryId;
    private List<Media.Poster> items = new ArrayList<>();
    private int sort;
    private int request;
    private boolean loadingCategories;

    BrowsePage(HomeActivity home, boolean movies) {
        super(home);
        this.movies = movies;
    }

    private SharedPreferences prefs() { return context.getSharedPreferences("ui", Context.MODE_PRIVATE); }

    @Override View build() {
        sort = Math.min(SORT_LABELS.length - 1, Math.max(0, prefs().getInt(movies ? "sort_movies" : "sort_series", 0)));
        LinearLayout row = new LinearLayout(context);
        categoryPanel = new CategoryPanel(context, category -> {
            categoryId = category.id;
            search.setText("");
            loadItems();
        });
        row.addView(categoryPanel, new LinearLayout.LayoutParams(Ui.dp(context, Math.max(150, Math.min(256, Math.round(Ui.widthDp(context) * 0.2f)))), -1));

        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        row.addView(column, Ui.margins(new LinearLayout.LayoutParams(0, -1, 1), Ui.dp(context, 12), 0, 0, 0));

        LinearLayout top = new LinearLayout(context);
        top.setGravity(Gravity.CENTER_VERTICAL);
        search = Ui.input(context, movies ? "Search movies..." : "Search series...", false);
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            public void onTextChanged(CharSequence s, int a, int b, int c) { render(); }
            public void afterTextChanged(Editable s) {}
        });
        top.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
        sortButton = Ui.glassButton(context, "", this::chooseSort);
        updateSortLabel();
        LinearLayout.LayoutParams gap = Ui.margins(new LinearLayout.LayoutParams(-2, -2), Ui.dp(context, 8), 0, 0, 0);
        top.addView(sortButton, gap);
        top.addView(Ui.glassButton(context, "⟳  Reload", this::reload), gap);
        column.addView(top, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(context, 10)));

        stage = new FrameLayout(context);
        stage.setBackgroundResource(R.drawable.bg_glass_panel);
        int pad = Ui.dp(context, 6);
        stage.setPadding(pad, pad, pad, pad);
        grid = new CardGrid(context, Ui.compact(context) ? 95 : 115);
        stage.addView(grid, new FrameLayout.LayoutParams(-1, -1));
        column.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));
        return row;
    }

    @Override void onShow() {
        List<Media.Category> cached = movies ? Session.movieCategories : Session.seriesCategories;
        if (cached == null) loadCategories();
        else if (categoryId == null) {
            if (cached.isEmpty()) {
                status(Ui.message(context, movies ? "No movies found" : "No series found"));
                return;
            }
            categoryId = cached.get(0).id;
            categoryPanel.setCategories(cached, categoryId);
            loadItems();
        } else render(); // refresh watch progress after playback
    }

    private void reload() {
        Session.clearLibrary();
        categoryId = null;
        loadCategories();
    }

    private void chooseSort() {
        new AlertDialog.Builder(context).setTitle("Sort by")
                .setSingleChoiceItems(SORT_LABELS, sort, (dialog, which) -> {
                    sort = which;
                    prefs().edit().putInt(movies ? "sort_movies" : "sort_series", which).apply();
                    updateSortLabel();
                    render();
                    dialog.dismiss();
                }).show();
    }

    private void updateSortLabel() { sortButton.setText("Sort: " + SORT_LABELS[sort] + " ▾"); }

    private void loadCategories() {
        if (loadingCategories) return;
        loadingCategories = true;
        int mine = ++request;
        status(Ui.loading(context, movies ? "Loading movies..." : "Loading series..."));
        Session.run(home, () -> Session.api().categories(movies ? "get_vod_categories" : "get_series_categories"), list -> {
            loadingCategories = false;
            if (mine != request) return;
            if (movies) Session.movieCategories = list; else Session.seriesCategories = list;
            onShow();
        }, error -> {
            loadingCategories = false;
            if (mine != request) return;
            status(Ui.errorBox(context, error + "  Use Reload to try again."));
        });
    }

    private void loadItems() {
        int mine = ++request;
        java.util.Map<String, List<Media.Poster>> cache = movies ? Session.movies : Session.series;
        List<Media.Poster> cached = cache.get(categoryId);
        if (cached != null) {
            items = cached;
            render();
            return;
        }
        items = new ArrayList<>();
        grid.setCards(new ArrayList<>());
        status(Ui.loading(context, movies ? "Loading movies..." : "Loading series..."));
        String category = categoryId;
        Session.run(home, () -> movies ? Session.api().movies(category) : Session.api().series(category), list -> {
            if (mine != request) return;
            cache.put(category, list);
            items = list;
            render();
        }, error -> {
            if (mine != request) return;
            status(Ui.errorBox(context, error + "  Use Reload to try again."));
        });
    }

    private void render() {
        if (categoryId == null) return;
        String term = search.getText().toString().trim().toLowerCase(Locale.ROOT);
        List<Media.Poster> list = new ArrayList<>();
        for (Media.Poster poster : items) {
            if (term.isEmpty() || poster.name.toLowerCase(Locale.ROOT).contains(term)) list.add(poster);
        }
        sortList(list);

        List<Card> cards = new ArrayList<>();
        if (term.isEmpty()) {
            List<HistoryStore.Entry> resume = new ArrayList<>();
            for (HistoryStore.Entry entry : Session.history.list(movies ? "movie" : "episode")) {
                if (entry.resumable() && resume.size() < 6) resume.add(entry);
            }
            if (!resume.isEmpty()) {
                cards.add(Card.header("Continue watching"));
                for (HistoryStore.Entry entry : resume) cards.add(resumeCard(entry));
                cards.add(Card.header(movies ? "Movies" : "Series"));
            }
        }
        for (Media.Poster poster : list) cards.add(posterCard(poster));
        grid.setCards(cards);
        boolean empty = list.isEmpty();
        if (empty) status(Ui.message(context, items.isEmpty() ? (movies ? "No movies found" : "No series found") : "Nothing matches your search"));
        else clearStatus();
    }

    private void sortList(List<Media.Poster> list) {
        if (sort == 0) return;
        Collections.sort(list, (a, b) -> {
            switch (sort) {
                case 1: return a.name.compareToIgnoreCase(b.name);
                case 2: return b.name.compareToIgnoreCase(a.name);
                case 3: return Double.compare(b.rating, a.rating);
                default: return Long.compare(b.added, a.added);
            }
        });
    }

    private Card posterCard(Media.Poster poster) {
        Card card = new Card(Card.POSTER);
        card.title = poster.name;
        card.image = poster.image;
        card.rating = poster.rating;
        card.subtitle = poster.year.length() >= 4 ? poster.year.substring(0, 4) : "";
        card.favorite = Session.favorites.contains(poster.kind, poster.id);
        card.toggleFavorite = () -> Session.favorites.toggle(FavoritesStore.Fav.of(poster));
        if (movies) {
            HistoryStore.Entry saved = Session.history.get("movie", poster.id);
            if (saved != null && saved.resumable()) card.progress = saved.progress();
        }
        card.click = () -> { if (movies) home.openMovie(poster); else home.openSeries(poster); };
        return card;
    }

    private Card resumeCard(HistoryStore.Entry entry) {
        Card card = new Card(Card.POSTER);
        card.title = entry.title;
        card.image = entry.image;
        card.subtitle = HistoryStore.formatTime(entry.position) + " / " + HistoryStore.formatTime(entry.duration);
        card.progress = entry.progress();
        card.click = () -> {
            XtreamApi api = Session.api();
            String url = movies ? api.movieUrl(entry.id, entry.ext) : api.episodeUrl(entry.id, entry.ext);
            PlayerActivity.vod(context, entry.title, url, entry, entry.position);
        };
        return card;
    }

    private void status(View view) {
        clearStatus();
        statusView = view;
        stage.addView(view, new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER));
    }

    private void clearStatus() {
        if (statusView != null) {
            stage.removeView(statusView);
            statusView = null;
        }
    }
}
