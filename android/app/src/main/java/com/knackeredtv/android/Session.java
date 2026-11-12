package com.knackeredtv.android;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** State for the profile that is currently signed in, plus a small background-work helper. */
final class Session {
    interface Work<T> { T run() throws Exception; }
    interface Done<T> { void ok(T value); }
    interface Fail { void error(String message); }

    private static final ExecutorService POOL = Executors.newFixedThreadPool(4);
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    static Profile profile;
    static Media.Account account;
    static FavoritesStore favorites;
    static HistoryStore history;

    static List<Media.Category> liveCategories;
    static List<Channel> live;
    static List<Media.Category> movieCategories, seriesCategories;
    static final Map<String, List<Media.Poster>> movies = new HashMap<>();
    static final Map<String, List<Media.Poster>> series = new HashMap<>();
    static List<Media.Poster> allMovies, allSeries;

    static void start(Context context, Profile p, Media.Account a, List<Channel> playlist) {
        profile = p;
        account = a;
        favorites = new FavoritesStore(context.getApplicationContext(), p.id);
        history = new HistoryStore(context.getApplicationContext(), p.id);
        clearLibrary();
        if (playlist != null) {
            live = playlist;
            liveCategories = PlaylistLoader.categories(playlist);
        }
    }

    static boolean isXtream() { return profile != null && profile.isXtream(); }

    static XtreamApi api() { return new XtreamApi(profile); }

    /** Forget everything downloaded so the next screen fetches it again. Playlists are re-downloaded too. */
    static void clearLibrary() {
        live = null;
        liveCategories = null;
        movieCategories = null;
        seriesCategories = null;
        movies.clear();
        series.clear();
        allMovies = null;
        allSeries = null;
    }

    static <T> void run(Activity owner, Work<T> work, Done<T> ok, Fail fail) {
        POOL.execute(() -> {
            try {
                T value = work.run();
                MAIN.post(() -> { if (alive(owner)) ok.ok(value); });
            } catch (Exception e) {
                String message = message(e);
                MAIN.post(() -> { if (alive(owner) && fail != null) fail.error(message); });
            }
        });
    }

    static void post(Runnable r) { POOL.execute(r); }

    private static boolean alive(Activity a) { return a != null && !a.isFinishing() && !a.isDestroyed(); }

    // Raw exception text can contain request URLs with credentials, so only vetted messages are shown
    static String message(Exception e) {
        if (e instanceof IllegalStateException && e.getMessage() != null) return e.getMessage();
        if (e instanceof org.json.JSONException) return "The server sent an unexpected response.";
        return "Could not reach the server. Check the address and your connection.";
    }

    static List<Channel> channelsIn(String categoryId) {
        List<Channel> result = new ArrayList<>();
        if (live == null) return result;
        for (Channel channel : live) if (channel.categoryId.equals(categoryId)) result.add(channel);
        return result;
    }
}
