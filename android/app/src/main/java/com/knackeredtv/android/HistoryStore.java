package com.knackeredtv.android;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Per-profile watch progress for movies and episodes ("continue watching"). */
final class HistoryStore {
    static final class Entry {
        final String kind; // "movie" or "episode"
        final String id, title, image, ext, seriesId;
        final int season, episode;
        final long position, duration, updated; // seconds, seconds, epoch millis

        Entry(String kind, String id, String title, String image, String ext, String seriesId, int season,
              int episode, long position, long duration, long updated) {
            this.kind = kind; this.id = id; this.title = title; this.image = image == null ? "" : image;
            this.ext = ext; this.seriesId = seriesId == null ? "" : seriesId; this.season = season;
            this.episode = episode; this.position = position; this.duration = duration; this.updated = updated;
        }

        boolean resumable() { return position > 10 && duration > 0 && position < duration - 30; }

        float progress() { return duration <= 0 ? 0 : Math.min(1f, position / (float) duration); }

        JSONObject toJson() throws Exception {
            return new JSONObject().put("kind", kind).put("id", id).put("title", title).put("image", image)
                    .put("ext", ext).put("seriesId", seriesId).put("season", season).put("episode", episode)
                    .put("position", position).put("duration", duration).put("updated", updated);
        }
    }

    private final SharedPreferences prefs;
    private final String profileId;
    private final List<Entry> entries = new ArrayList<>();

    HistoryStore(Context context, String profileId) {
        prefs = context.getSharedPreferences("history_v1", Context.MODE_PRIVATE);
        this.profileId = profileId;
        try {
            JSONArray array = new JSONArray(prefs.getString(profileId, "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject o = array.getJSONObject(i);
                entries.add(new Entry(o.getString("kind"), o.getString("id"), o.optString("title"), o.optString("image"),
                        o.optString("ext", "mp4"), o.optString("seriesId"), o.optInt("season"), o.optInt("episode"),
                        o.optLong("position"), o.optLong("duration"), o.optLong("updated")));
            }
        } catch (Exception ignored) {
            entries.clear();
        }
    }

    Entry get(String kind, String id) {
        for (Entry e : entries) if (e.kind.equals(kind) && e.id.equals(id)) return e;
        return null;
    }

    /** Newest first. */
    List<Entry> list(String kind) {
        List<Entry> result = new ArrayList<>();
        for (Entry e : entries) if (e.kind.equals(kind)) result.add(e);
        Collections.sort(result, (a, b) -> Long.compare(b.updated, a.updated));
        return result;
    }

    void save(Entry entry) {
        for (int i = 0; i < entries.size(); i++) {
            if (entries.get(i).kind.equals(entry.kind) && entries.get(i).id.equals(entry.id)) {
                entries.remove(i);
                break;
            }
        }
        entries.add(entry);
        // Keep the list bounded; old finished items are the least useful
        Collections.sort(entries, (a, b) -> Long.compare(b.updated, a.updated));
        while (entries.size() > 300) entries.remove(entries.size() - 1);
        persist();
    }

    void clear() {
        entries.clear();
        persist();
    }

    private void persist() {
        try {
            JSONArray array = new JSONArray();
            for (Entry e : entries) array.put(e.toJson());
            prefs.edit().putString(profileId, array.toString()).apply();
        } catch (Exception ignored) {
            // Progress is a convenience; never crash because it could not be saved.
        }
    }

    static void forget(Context context, String profileId) {
        context.getSharedPreferences("history_v1", Context.MODE_PRIVATE).edit().remove(profileId).apply();
    }

    static String formatTime(long seconds) {
        long h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60;
        return h > 0 ? String.format(java.util.Locale.ROOT, "%d:%02d:%02d", h, m, s)
                : String.format(java.util.Locale.ROOT, "%d:%02d", m, s);
    }
}
