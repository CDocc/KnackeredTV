package com.knackeredtv.android;

import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class LiveTvPage extends Page {
    private static final class LiveData {
        final List<Media.Category> categories;
        final List<Channel> channels;
        LiveData(List<Media.Category> categories, List<Channel> channels) { this.categories = categories; this.channels = channels; }
    }

    private CategoryPanel categoryPanel;
    private CardGrid grid;
    private EditText search;
    private FrameLayout stage;
    private String categoryId;
    private boolean loading;
    private int request;

    LiveTvPage(HomeActivity home) { super(home); }

    @Override View build() {
        LinearLayout row = new LinearLayout(context);
        categoryPanel = new CategoryPanel(context, category -> {
            categoryId = category.id;
            search.setText("");
            refresh();
        });
        row.addView(categoryPanel, new LinearLayout.LayoutParams(Ui.dp(context, Math.max(150, Math.min(256, Math.round(Ui.widthDp(context) * 0.2f)))), -1));

        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        row.addView(column, Ui.margins(new LinearLayout.LayoutParams(0, -1, 1), Ui.dp(context, 12), 0, 0, 0));

        LinearLayout top = new LinearLayout(context);
        top.setGravity(Gravity.CENTER_VERTICAL);
        search = Ui.input(context, "Search channels...", false);
        search.addTextChangedListener(new TextWatcher() {
            public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            public void onTextChanged(CharSequence s, int a, int b, int c) { refresh(); }
            public void afterTextChanged(Editable s) {}
        });
        top.addView(search, new LinearLayout.LayoutParams(0, -2, 1));
        top.addView(Ui.glassButton(context, "⟳  Reload", this::reload), Ui.margins(new LinearLayout.LayoutParams(-2, -2), Ui.dp(context, 8), 0, 0, 0));
        column.addView(top, Ui.margins(new LinearLayout.LayoutParams(-1, -2), 0, 0, 0, Ui.dp(context, 10)));

        stage = new FrameLayout(context);
        stage.setBackgroundResource(R.drawable.bg_glass_panel);
        int pad = Ui.dp(context, 6);
        stage.setPadding(pad, pad, pad, pad);
        grid = new CardGrid(context, Ui.compact(context) ? 125 : 150);
        stage.addView(grid, new FrameLayout.LayoutParams(-1, -1));
        column.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));
        return row;
    }

    @Override void onShow() {
        if (Session.live == null) load();
        else if (categoryId == null) showData();
    }

    private void reload() {
        Session.clearLibrary();
        categoryId = null;
        load();
    }

    private void load() {
        if (loading) return;
        loading = true;
        int mine = ++request;
        status(Ui.loading(context, "Loading channels..."));
        Session.run(home, () -> {
            if (Session.isXtream()) {
                XtreamApi api = Session.api();
                List<Media.Category> categories = api.categories("get_live_categories");
                return new LiveData(categories, api.liveChannels(categories));
            }
            List<Channel> channels = PlaylistLoader.load(home, Session.profile);
            return new LiveData(PlaylistLoader.categories(channels), channels);
        }, data -> {
            loading = false;
            if (mine != request) return;
            Session.liveCategories = data.categories;
            Session.live = data.channels;
            showData();
        }, error -> {
            loading = false;
            if (mine != request) return;
            status(Ui.errorBox(context, error + "  Use Reload to try again."));
        });
    }

    private void showData() {
        clearStatus();
        if (Session.liveCategories == null || Session.liveCategories.isEmpty()) {
            status(Ui.message(context, "No channels available"));
            return;
        }
        categoryId = Session.liveCategories.get(0).id;
        categoryPanel.setCategories(Session.liveCategories, categoryId);
        refresh();
    }

    private void refresh() {
        if (categoryId == null || Session.live == null) return;
        String term = search.getText().toString().trim().toLowerCase(Locale.ROOT);
        List<Channel> channels = Session.channelsIn(categoryId);
        List<Card> cards = new ArrayList<>();
        for (Channel channel : channels) {
            if (!term.isEmpty() && !channel.name.toLowerCase(Locale.ROOT).contains(term)) continue;
            Card card = new Card(Card.LIVE);
            card.title = channel.name;
            card.subtitle = channel.category;
            card.image = channel.logo;
            card.favorite = Session.favorites.contains("live", channel.id);
            card.toggleFavorite = () -> Session.favorites.toggle(FavoritesStore.Fav.of(channel));
            card.click = () -> PlayerActivity.live(home, channel.name, channel.url, channel.fallbackUrl);
            cards.add(card);
        }
        grid.setCards(cards);
        if (cards.isEmpty()) status(Ui.message(context, channels.isEmpty() ? "No channels in this category" : "No channels match your search"));
        else clearStatus();
    }

    private View statusView;

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
