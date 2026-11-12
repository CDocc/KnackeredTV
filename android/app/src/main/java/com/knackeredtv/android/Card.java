package com.knackeredtv.android;

/** One cell in a {@link CardGrid}: a poster, a live channel tile or a full-width section heading. */
final class Card {
    static final int POSTER = 0, LIVE = 1, HEADER = 2;

    interface Toggle { boolean run(); }

    final int type;
    String title = "", subtitle = "", image = "";
    double rating;
    float progress;
    boolean favorite;
    boolean selected;
    Runnable click;
    Toggle toggleFavorite;

    Card(int type) { this.type = type; }

    static Card header(String title) {
        Card card = new Card(HEADER);
        card.title = title;
        return card;
    }
}
