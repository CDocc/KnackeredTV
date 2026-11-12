package com.knackeredtv.android;

import android.content.Context;
import android.view.View;

/** One section of the app (Live TV, Movies, ...) shown in the content area next to the sidebar. */
abstract class Page {
    protected final HomeActivity home;
    protected final Context context;
    private View view;

    Page(HomeActivity home) {
        this.home = home;
        this.context = home;
    }

    final View view() {
        if (view == null) view = build();
        return view;
    }

    abstract View build();

    /** Called each time the page is brought to the front. */
    void onShow() {}

    /** Return true if the back press was consumed by the page. */
    boolean onBack() { return false; }
}
