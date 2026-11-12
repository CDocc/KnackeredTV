package com.knackeredtv.android;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class M3uParser {
    private static final Pattern ATTRIBUTE = Pattern.compile("([\\w-]+)=\"([^\"]*)\"");

    static List<Channel> parse(String text, String base) {
        List<Channel> channels = new ArrayList<>();
        String title = null;
        String group = null;
        String logo = "";
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.startsWith("#EXTINF:")) {
                int comma = delimiter(line);
                title = comma < 0 ? "" : line.substring(comma + 1).trim();
                group = attribute(line, "group-title");
                logo = attribute(line, "tvg-logo");
                if (title.isEmpty()) title = attribute(line, "tvg-name");
                if (title.isEmpty()) title = "Unnamed channel";
                // iptv-org lists several groups separated by semicolons; the first is the main one
                int semicolon = group.indexOf(';');
                if (semicolon > 0) group = group.substring(0, semicolon).trim();
                if (group.isEmpty()) group = "Uncategorized";
            } else if (line.startsWith("#EXTGRP:") && title != null && group.equals("Uncategorized")) {
                String value = line.substring(8).trim();
                if (!value.isEmpty()) group = value;
            } else if (!line.isEmpty() && !line.startsWith("#") && title != null) {
                try {
                    URI uri = base == null ? URI.create(line) : URI.create(base).resolve(line);
                    if ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) {
                        String url = uri.toString();
                        channels.add(new Channel(hash(url + "\n" + group), title, group, group, logo, url, null));
                    }
                } catch (IllegalArgumentException ignored) {
                    // Skip malformed entries without preventing other channels from loading.
                }
                title = null;
            }
        }
        return channels;
    }

    private static int delimiter(String line) {
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            if (line.charAt(i) == '"') quoted = !quoted;
            if (line.charAt(i) == ',' && !quoted) return i;
        }
        return -1;
    }

    private static String attribute(String line, String name) {
        Matcher matcher = ATTRIBUTE.matcher(line);
        while (matcher.find()) {
            if (matcher.group(1).equalsIgnoreCase(name)) return matcher.group(2).trim();
        }
        return "";
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : digest) result.append(String.format("%02x", b & 0xff));
            return result.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
