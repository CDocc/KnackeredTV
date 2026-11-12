package com.knackeredtv.android;

import java.util.Objects;

final class Channel {
    final String id;
    final String name;
    final String category;
    final String categoryId;
    final String logo;
    final String url;
    final String fallbackUrl;

    Channel(String id, String name, String category, String categoryId, String logo, String url, String fallbackUrl) {
        this.id = Objects.requireNonNull(id);
        this.name = Objects.requireNonNull(name);
        this.category = Objects.requireNonNull(category);
        this.categoryId = Objects.requireNonNull(categoryId);
        this.logo = logo == null ? "" : logo;
        this.url = Objects.requireNonNull(url);
        this.fallbackUrl = fallbackUrl;
    }
}
