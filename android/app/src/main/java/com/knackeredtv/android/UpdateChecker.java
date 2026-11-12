package com.knackeredtv.android;

import android.content.Context;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Looks for newer releases on GitHub and reads their change logs. */
final class UpdateChecker {
    static final String RELEASES_API = "https://api.github.com/repos/CDocc/KnackeredTV/releases?per_page=20";
    static final String RELEASES_PAGE = "https://github.com/CDocc/KnackeredTV/releases";

    private static final Pattern VERSION = Pattern.compile("^v?(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?(?:-([0-9A-Za-z.-]+))?(?:\\+.*)?$");
    private static final String[] NOTES_END = {"<!-- downloads -->", "## Which file do I download?"};

    static final class Release {
        final String version, tag, name, notes, url, date;
        Release(String version, String tag, String name, String notes, String url, String date) {
            this.version = version; this.tag = tag; this.name = name; this.notes = notes; this.url = url; this.date = date;
        }
    }

    static final class Result {
        final String current;
        final String latest;
        final List<Release> newer;
        final Release currentRelease;
        Result(String current, String latest, List<Release> newer, Release currentRelease) {
            this.current = current; this.latest = latest; this.newer = newer; this.currentRelease = currentRelease;
        }
        boolean updateAvailable() { return !newer.isEmpty(); }
    }

    /** Last successful check, shared by the sidebar badge and the settings page. */
    static Result last;

    static String currentVersion(Context context) {
        try {
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    static Result check(String current) throws Exception {
        Result result = evaluate(current, parse(Http.get(RELEASES_API, 2 * 1024 * 1024)));
        last = result;
        return result;
    }

    static Result evaluate(String current, List<Release> releases) {
        List<Release> newer = new ArrayList<>();
        Release currentRelease = null;
        for (Release release : releases) {
            int cmp = compare(release.version, current);
            if (cmp > 0) newer.add(release);
            else if (cmp == 0) currentRelease = release;
        }
        return new Result(current, releases.isEmpty() ? null : releases.get(0).version, newer, currentRelease);
    }

    static List<Release> parse(String json) throws Exception {
        JSONArray array = new JSONArray(json);
        List<Release> releases = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject item = array.optJSONObject(i);
            if (item == null || item.optBoolean("draft") || item.optBoolean("prerelease")) continue;
            String tag = item.optString("tag_name", "");
            if (!VERSION.matcher(tag).matches()) continue;
            releases.add(new Release(tag.startsWith("v") ? tag.substring(1) : tag, tag,
                    item.optString("name", tag).isEmpty() ? tag : item.optString("name", tag),
                    notes(item.optString("body", "")), item.optString("html_url", RELEASES_PAGE), item.optString("published_at", "")));
        }
        Collections.sort(releases, (a, b) -> compare(b.version, a.version));
        return releases;
    }

    /** Keeps the change log part of a release body and drops the download instructions. */
    static String notes(String body) {
        String text = body.replace("\r\n", "\n");
        for (String marker : NOTES_END) {
            int at = text.indexOf(marker);
            if (at >= 0) text = text.substring(0, at);
        }
        return text.trim();
    }

    /** Negative when a is older than b, positive when newer, 0 when equal or not comparable. */
    static int compare(String a, String b) {
        Matcher left = VERSION.matcher(a.trim()), right = VERSION.matcher(b.trim());
        if (!left.matches() || !right.matches()) return 0;
        for (int i = 1; i <= 3; i++) {
            int x = number(left.group(i)), y = number(right.group(i));
            if (x != y) return x < y ? -1 : 1;
        }
        String x = left.group(4) == null ? "" : left.group(4), y = right.group(4) == null ? "" : right.group(4);
        if (x.equals(y)) return 0;
        if (x.isEmpty()) return 1;
        if (y.isEmpty()) return -1;
        return x.compareTo(y) < 0 ? -1 : 1;
    }

    private static int number(String digits) {
        if (digits == null) return 0;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE;
        }
    }
}
