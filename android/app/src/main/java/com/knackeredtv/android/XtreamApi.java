package com.knackeredtv.android;

import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Blocking Xtream Codes client; always call it off the main thread. */
final class XtreamApi {
    private static final int LIBRARY_BYTES = 80 * 1024 * 1024;
    private final String base, user, pass;

    XtreamApi(Profile profile) {
        base = clean(profile.location).replaceAll("/+$", "");
        user = clean(profile.username);
        pass = clean(profile.password);
    }

    // Providers often paste invisible characters into URLs and passwords
    private static String clean(String value) {
        return value == null ? "" : value.replaceAll("[\\u200B-\\u200F\\u2060\\uFEFF\\s]", "");
    }

    private String api(String action, String... extra) {
        Uri.Builder builder = Uri.parse(base + "/player_api.php").buildUpon()
                .appendQueryParameter("username", user).appendQueryParameter("password", pass);
        if (action != null) builder.appendQueryParameter("action", action);
        for (int i = 0; i + 1 < extra.length; i += 2) builder.appendQueryParameter(extra[i], extra[i + 1]);
        return builder.build().toString();
    }

    private String stream(String type, String id, String ext) {
        return Uri.parse(base).buildUpon().appendPath(type).appendPath(user).appendPath(pass)
                .appendPath(id + "." + ext).build().toString();
    }

    String movieUrl(String id, String ext) { return stream("movie", id, ext.isEmpty() ? "mp4" : ext); }

    String episodeUrl(String id, String ext) { return stream("series", id, ext.isEmpty() ? "mp4" : ext); }

    Media.Account authenticate() throws Exception {
        JSONObject root = new JSONObject(Http.get(api(null), 2 * 1024 * 1024));
        JSONObject info = root.optJSONObject("user_info");
        if (info == null || (info.has("auth") && info.optInt("auth", 1) != 1)) {
            throw new IllegalStateException("Login failed. Check the server address, username and password.");
        }
        return new Media.Account(info.optString("status", "Active"), info.optLong("exp_date", 0),
                info.optInt("max_connections", 1));
    }

    List<Media.Category> categories(String action) throws Exception {
        JSONArray array = new JSONArray(Http.get(api(action), 8 * 1024 * 1024));
        List<Media.Category> result = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null) continue;
            result.add(new Media.Category(item.optString("category_id"), item.optString("category_name", "Uncategorized")));
        }
        return result;
    }

    List<Channel> liveChannels(List<Media.Category> categories) throws Exception {
        Map<String, String> names = new HashMap<>();
        for (Media.Category category : categories) names.put(category.id, category.name);
        JSONArray array = new JSONArray(Http.get(api("get_live_streams"), LIBRARY_BYTES));
        List<Channel> result = new ArrayList<>(array.length());
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("stream_id");
            if (id.isEmpty()) continue;
            String categoryId = item.optString("category_id");
            String name = names.containsKey(categoryId) ? names.get(categoryId) : "Uncategorized";
            result.add(new Channel(id, item.optString("name", "Unnamed channel"), name, categoryId,
                    item.optString("stream_icon"), stream("live", id, "m3u8"), stream("live", id, "ts")));
        }
        return result;
    }

    List<Media.Poster> movies(String categoryId) throws Exception {
        String text = categoryId == null ? Http.get(api("get_vod_streams"), LIBRARY_BYTES)
                : Http.get(api("get_vod_streams", "category_id", categoryId), LIBRARY_BYTES);
        JSONArray array = new JSONArray(text);
        List<Media.Poster> result = new ArrayList<>(array.length());
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null || item.optString("stream_id").isEmpty()) continue;
            String ext = item.optString("container_extension", "mp4");
            result.add(new Media.Poster("movie", item.optString("stream_id"), item.optString("name", "Unnamed"),
                    item.optString("stream_icon"), ext.isEmpty() ? "mp4" : ext, "", "", "",
                    number(item.optString("rating")), item.optLong("added", 0)));
        }
        return result;
    }

    List<Media.Poster> series(String categoryId) throws Exception {
        String text = categoryId == null ? Http.get(api("get_series"), LIBRARY_BYTES)
                : Http.get(api("get_series", "category_id", categoryId), LIBRARY_BYTES);
        JSONArray array = new JSONArray(text);
        List<Media.Poster> result = new ArrayList<>(array.length());
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null || item.optString("series_id").isEmpty()) continue;
            String year = item.optString("releaseDate", item.optString("release_date", ""));
            result.add(new Media.Poster("series", item.optString("series_id"), item.optString("name", "Unnamed"),
                    item.optString("cover"), "", item.optString("plot"), year, item.optString("genre"),
                    number(item.optString("rating")), item.optLong("last_modified", 0)));
        }
        return result;
    }

    Media.MovieInfo movieInfo(String id) throws Exception {
        JSONObject root = new JSONObject(Http.get(api("get_vod_info", "vod_id", id), 4 * 1024 * 1024));
        JSONObject info = object(root, "info");
        JSONObject data = object(root, "movie_data");
        Media.MovieInfo result = new Media.MovieInfo();
        result.plot = first(info.optString("plot"), info.optString("description"));
        result.cast = first(info.optString("cast"), info.optString("actors"));
        result.director = info.optString("director");
        result.genre = info.optString("genre");
        result.year = first(info.optString("releasedate"), info.optString("release_date"));
        result.duration = info.optString("duration");
        result.rating = number(info.optString("rating"));
        result.poster = first(info.optString("movie_image"), info.optString("cover_big"));
        result.backdrop = firstString(info.opt("backdrop_path"));
        result.ext = first(data.optString("container_extension"), "mp4");
        return result;
    }

    Media.SeriesInfo seriesInfo(String id) throws Exception {
        JSONObject root = new JSONObject(Http.get(api("get_series_info", "series_id", id), 8 * 1024 * 1024));
        JSONObject info = object(root, "info");
        Map<Integer, List<Media.Episode>> episodes = new TreeMap<>();
        Object raw = root.opt("episodes");
        if (raw instanceof JSONObject) {
            JSONObject seasons = (JSONObject) raw;
            java.util.Iterator<String> keys = seasons.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                addEpisodes(episodes, seasons.optJSONArray(key), parseInt(key, 1));
            }
        } else if (raw instanceof JSONArray) {
            // Some providers return a flat array (or an array of arrays) instead of a season-keyed object
            JSONArray groups = (JSONArray) raw;
            for (int i = 0; i < groups.length(); i++) {
                Object entry = groups.opt(i);
                if (entry instanceof JSONArray) addEpisodes(episodes, (JSONArray) entry, 0);
                else if (entry instanceof JSONObject) {
                    JSONArray single = new JSONArray();
                    single.put(entry);
                    addEpisodes(episodes, single, 0);
                }
            }
        }
        for (List<Media.Episode> list : episodes.values()) {
            Collections.sort(list, (a, b) -> Integer.compare(a.episode, b.episode));
        }
        Media.SeriesInfo result = new Media.SeriesInfo();
        result.plot = info.optString("plot");
        result.cast = info.optString("cast");
        result.genre = info.optString("genre");
        result.year = first(info.optString("releaseDate"), info.optString("release_date"));
        result.rating = number(info.optString("rating"));
        result.poster = info.optString("cover");
        result.backdrop = firstString(info.opt("backdrop_path"));
        result.episodes = episodes;
        result.seasons = new ArrayList<>(episodes.keySet());
        return result;
    }

    private static void addEpisodes(Map<Integer, List<Media.Episode>> target, JSONArray array, int fixedSeason) {
        if (array == null) return;
        for (int i = 0; i < array.length(); i++) {
            JSONObject ep = array.optJSONObject(i);
            if (ep == null || ep.optString("id").isEmpty()) continue;
            int season = fixedSeason > 0 ? fixedSeason : parseInt(ep.optString("season"), 1);
            int number = parseInt(ep.optString("episode_num"), 0);
            JSONObject details = object(ep, "info");
            String title = ep.optString("title");
            if (title.isEmpty()) title = "Episode " + number;
            if (!target.containsKey(season)) target.put(season, new ArrayList<>());
            target.get(season).add(new Media.Episode(ep.optString("id"), season, number, title,
                    first(ep.optString("container_extension"), "mp4"), details.optString("plot"),
                    details.optString("movie_image"), details.optString("duration")));
        }
    }

    // Xtream returns [] instead of {} for empty objects
    private static JSONObject object(JSONObject parent, String key) {
        JSONObject value = parent.optJSONObject(key);
        return value == null ? new JSONObject() : value;
    }

    private static String first(String a, String b) { return a != null && !a.isEmpty() && !a.equals("null") ? a : b; }

    private static String firstString(Object value) {
        if (value instanceof JSONArray) return ((JSONArray) value).length() > 0 ? ((JSONArray) value).optString(0) : "";
        return value == null || value == JSONObject.NULL ? "" : value.toString();
    }

    private static double number(String value) {
        try { return Double.parseDouble(value); } catch (Exception e) { return 0; }
    }

    private static int parseInt(String value, int fallback) {
        try { return Integer.parseInt(value.trim()); } catch (Exception e) { return fallback; }
    }
}
