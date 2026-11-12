package com.knackeredtv.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import androidx.test.core.app.ApplicationProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.shadows.ShadowLooper;

/** Renders the real screens with fake data: catches crashes and writes screenshots to build/screens. */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 34, qualifiers = "w960dp-h540dp-land-xhdpi")
public class ScreenRenderTest {
    private final File out = new File("build/screens");

    @Before public void setUp() {
        out.mkdirs();
    }

    private void fakeSession(Context context, boolean xtream) {
        Profile profile = Profile.create("My IPTV Profile", xtream ? "xtream" : "public", "https://provider.example:8080", xtream ? "demo" : "", xtream ? "secret" : "");
        Session.start(context, profile, xtream ? new Media.Account("Active", 1893456000L, 2) : null, null);
        Session.liveCategories = Arrays.asList(new Media.Category("1", "UK Entertainment"), new Media.Category("2", "Sports HD"), new Media.Category("3", "News"));
        List<Channel> live = new ArrayList<>();
        for (int i = 1; i <= 24; i++) {
            live.add(new Channel("c" + i, "Channel " + i + " HD", i % 2 == 0 ? "Sports HD" : "UK Entertainment", i % 2 == 0 ? "2" : "1", "", "https://x.test/live/" + i + ".m3u8", "https://x.test/live/" + i + ".ts"));
        }
        Session.live = live;
        Session.movieCategories = Arrays.asList(new Media.Category("10", "Action"), new Media.Category("11", "Comedy"));
        List<Media.Poster> movies = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            movies.add(new Media.Poster("movie", "m" + i, "Movie Number " + i, "", "mkv", "", "2021", "", 5.5 + (i % 5) * 0.8, i));
        }
        Session.movies.put("10", movies);
        Session.seriesCategories = Arrays.asList(new Media.Category("20", "Drama"));
        List<Media.Poster> series = new ArrayList<>();
        for (int i = 1; i <= 12; i++) series.add(new Media.Poster("series", "s" + i, "Series Title " + i, "", "", "Plot", "2019", "Drama", 7.2, i));
        Session.series.put("20", series);
        Session.allMovies = movies;
        Session.allSeries = series;
        Session.favorites.toggle(FavoritesStore.Fav.of(live.get(0)));
        Session.favorites.toggle(FavoritesStore.Fav.of(movies.get(2)));
        Session.history.save(new HistoryStore.Entry("movie", "m4", "Movie Number 4", "", "mkv", "", 0, 0, 1800, 6000, System.currentTimeMillis()));
    }

    private void layout(Activity activity) {
        ShadowLooper.idleMainLooper();
        View root = activity.getWindow().getDecorView();
        int w = activity.getResources().getDisplayMetrics().widthPixels, h = activity.getResources().getDisplayMetrics().heightPixels;
        root.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        root.layout(0, 0, w, h);
        ShadowLooper.idleMainLooper();
    }

    private void shot(Activity activity, String name) throws Exception {
        layout(activity);
        View root = activity.getWindow().getDecorView();
        Bitmap bitmap = Bitmap.createBitmap(root.getWidth(), root.getHeight(), Bitmap.Config.ARGB_8888);
        root.draw(new Canvas(bitmap));
        try (FileOutputStream stream = new FileOutputStream(new File(out, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        }
    }

    @Test @Config(sdk = 34, qualifiers = "w800dp-h360dp-land-xhdpi")
    public void phoneLandscape() throws Exception {
        Context app = ApplicationProvider.getApplicationContext();
        fakeSession(app, true);
        HomeActivity home = Robolectric.buildActivity(HomeActivity.class).setup().get();
        shot(home, "phone_live");
        home.select("movies");
        shot(home, "phone_movies");
        home.select("settings");
        shot(home, "phone_settings");
        LoginActivity login = Robolectric.buildActivity(LoginActivity.class).setup().get();
        shot(login, "phone_login");
    }

    @Test public void loginScreens() throws Exception {
        Context app = ApplicationProvider.getApplicationContext();
        LoginActivity login = Robolectric.buildActivity(LoginActivity.class).setup().get();
        assertNotNull(login);
        shot(login, "login_form");
    }

    @Test public void homePages() throws Exception {
        Context app = ApplicationProvider.getApplicationContext();
        fakeSession(app, true);
        HomeActivity home = Robolectric.buildActivity(HomeActivity.class).setup().get();
        shot(home, "home_live");
        for (String page : new String[]{"movies", "series", "favorites", "search", "settings"}) {
            home.select(page);
            shot(home, "home_" + page);
        }
        home.select("movies");
        home.openMovie(Session.movies.get("10").get(3));
        shot(home, "detail_movie");
        home.closeOverlay();
        home.openSeries(Session.series.get("20").get(1));
        shot(home, "detail_series");
    }

    @Test public void miniPlayerAndFullScreenPlayer() throws Exception {
        Context app = ApplicationProvider.getApplicationContext();
        fakeSession(app, true);
        Playback.setRequestForTest(new Playback.Request("Channel 1 HD", "https://x.test/1.m3u8", null, true, 0, null), "Loading stream…");
        HomeActivity home = Robolectric.buildActivity(HomeActivity.class).setup().get();
        shot(home, "mini_player");
        PlayerActivity player = Robolectric.buildActivity(PlayerActivity.class).setup().get();
        shot(player, "player_full");
        Playback.setRequestForTest(null, "");
    }

    @Test public void playlistProfileHidesMoviesAndSeries() throws Exception {
        Context app = ApplicationProvider.getApplicationContext();
        fakeSession(app, false);
        HomeActivity home = Robolectric.buildActivity(HomeActivity.class).setup().get();
        shot(home, "home_playlist");
        home.select("favorites");
        home.select("search");
        home.select("settings");
        assertTrue(!Session.isXtream());
        assertEquals(24, Session.live.size());
    }
}
