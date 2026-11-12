package com.knackeredtv.android;

import java.util.List;
import java.util.Map;

/** Plain data holders shared by the API client, the stores and the screens. */
final class Media {
    private Media() {}

    static final class Category {
        final String id, name;
        Category(String id, String name) { this.id = id; this.name = name; }
    }

    /** A movie or series entry shown as a poster card. */
    static final class Poster {
        final String kind; // "movie" or "series"
        final String id, name, image, ext, plot, year, genre;
        final double rating;
        final long added;

        Poster(String kind, String id, String name, String image, String ext, String plot, String year,
               String genre, double rating, long added) {
            this.kind = kind; this.id = id; this.name = name; this.image = image; this.ext = ext;
            this.plot = plot; this.year = year; this.genre = genre; this.rating = rating; this.added = added;
        }
    }

    static final class MovieInfo {
        String plot = "", cast = "", director = "", genre = "", year = "", duration = "", poster = "", backdrop = "";
        String ext = "mp4";
        double rating;
    }

    static final class Episode {
        final String id, title, ext, plot, image, duration;
        final int season, episode;

        Episode(String id, int season, int episode, String title, String ext, String plot, String image, String duration) {
            this.id = id; this.season = season; this.episode = episode; this.title = title; this.ext = ext;
            this.plot = plot; this.image = image; this.duration = duration;
        }
    }

    static final class SeriesInfo {
        String plot = "", cast = "", genre = "", year = "", poster = "", backdrop = "";
        double rating;
        List<Integer> seasons;
        Map<Integer, List<Episode>> episodes;
    }

    static final class Account {
        final String status;
        final long expires; // seconds since epoch, 0 when unknown
        final int maxConnections;

        Account(String status, long expires, int maxConnections) {
            this.status = status; this.expires = expires; this.maxConnections = maxConnections;
        }
    }
}
