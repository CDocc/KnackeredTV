package com.knackeredtv.android;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Per-profile favorites for live channels, movies and series. */
final class FavoritesStore {
    static final class Fav {
        final String kind, id, name, image, url, fallback, ext;
        final double rating;

        Fav(String kind, String id, String name, String image, String url, String fallback, String ext, double rating) {
            this.kind = kind; this.id = id; this.name = name; this.image = image == null ? "" : image;
            this.url = url == null ? "" : url; this.fallback = fallback == null ? "" : fallback;
            this.ext = ext == null ? "" : ext; this.rating = rating;
        }

        static Fav of(Channel c) { return new Fav("live", c.id, c.name, c.logo, c.url, c.fallbackUrl, "", 0); }

        static Fav of(Media.Poster p) { return new Fav(p.kind, p.id, p.name, p.image, "", "", p.ext, p.rating); }
    }

    private final SharedPreferences prefs;
    private final String profileId;
    private final List<Fav> items = new ArrayList<>();

    FavoritesStore(Context context, String profileId) {
        this.prefs = context.getSharedPreferences("favorites_v2", Context.MODE_PRIVATE);
        this.profileId = profileId;
        try {
            JSONArray array = new JSONArray(prefs.getString(profileId, "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject o = array.getJSONObject(i);
                items.add(new Fav(o.getString("kind"), o.getString("id"), o.optString("name"), o.optString("image"),
                        o.optString("url"), o.optString("fallback"), o.optString("ext"), o.optDouble("rating", 0)));
            }
        } catch (Exception ignored) {
            items.clear();
        }
    }

    boolean contains(String kind, String id) { return indexOf(kind, id) >= 0; }

    List<Fav> list(String kind) {
        List<Fav> result = new ArrayList<>();
        for (Fav fav : items) if (fav.kind.equals(kind)) result.add(fav);
        return result;
    }

    /** Returns true when the item is now a favorite. */
    boolean toggle(Fav fav) {
        int index = indexOf(fav.kind, fav.id);
        boolean added = index < 0;
        if (added) items.add(0, fav); else items.remove(index);
        save();
        return added;
    }

    void clear() {
        items.clear();
        save();
    }

    private int indexOf(String kind, String id) {
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).kind.equals(kind) && items.get(i).id.equals(id)) return i;
        }
        return -1;
    }

    private void save() {
        try {
            JSONArray array = new JSONArray();
            for (Fav f : items) {
                array.put(new JSONObject().put("kind", f.kind).put("id", f.id).put("name", f.name)
                        .put("image", f.image).put("url", f.url).put("fallback", f.fallback)
                        .put("ext", f.ext).put("rating", f.rating));
            }
            prefs.edit().putString(profileId, array.toString()).apply();
        } catch (Exception ignored) {
            // Favorites are a convenience; failing to persist one must not crash playback.
        }
    }

    static void forget(Context context, String profileId) {
        context.getSharedPreferences("favorites_v2", Context.MODE_PRIVATE).edit().remove(profileId).apply();
    }
}
