package com.knackeredtv.android;

import android.content.Context;
import android.net.Uri;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Downloads and parses M3U playlists (web addresses or files picked on the device). */
final class PlaylistLoader {
    static List<Channel> load(Context context, Profile profile) throws Exception {
        String text;
        String base = null;
        if (profile.location.startsWith("content:")) {
            try (InputStream input = context.getContentResolver().openInputStream(Uri.parse(profile.location))) {
                if (input == null) throw new IllegalStateException("Could not open the playlist file");
                text = Http.read(input, 60 * 1024 * 1024);
            }
        } else {
            base = profile.location;
            text = Http.get(profile.location, 60 * 1024 * 1024);
        }
        if (!text.contains("#EXTM3U") && !text.contains("#EXTINF")) {
            throw new IllegalStateException("That address did not return an M3U playlist");
        }
        List<Channel> channels = M3uParser.parse(text, base);
        if (channels.isEmpty()) throw new IllegalStateException("No playable channels were found in the playlist");
        return channels;
    }

    static List<Media.Category> categories(List<Channel> channels) {
        Map<String, Media.Category> unique = new LinkedHashMap<>();
        for (Channel channel : channels) {
            if (!unique.containsKey(channel.categoryId)) {
                unique.put(channel.categoryId, new Media.Category(channel.categoryId, channel.category));
            }
        }
        List<Media.Category> result = new ArrayList<>(unique.values());
        java.util.Collections.sort(result, (a, b) -> a.name.compareToIgnoreCase(b.name));
        return result;
    }
}
