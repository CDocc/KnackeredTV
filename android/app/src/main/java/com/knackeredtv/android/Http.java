package com.knackeredtv.android;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class Http {
    private static final int MAX_REDIRECTS = 6;

    /**
     * Fetches a text resource. Redirects are followed by hand because HttpURLConnection refuses
     * http to https redirects, which many IPTV providers use.
     */
    static String get(String address, int maxBytes) throws IOException {
        String current = address;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            URL url = new URL(current);
            if (!url.getProtocol().equals("http") && !url.getProtocol().equals("https")) {
                throw new IllegalStateException("Only HTTP and HTTPS addresses are supported");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(40000);
            connection.setRequestProperty("User-Agent", "KnackeredTV");
            try {
                int status = connection.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IllegalStateException("The server sent an invalid redirect");
                    current = new URL(url, location).toString();
                    continue;
                }
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("The server answered with HTTP " + status);
                }
                try (InputStream input = connection.getInputStream()) {
                    return read(input, maxBytes);
                }
            } finally {
                connection.disconnect();
            }
        }
        throw new IllegalStateException("The server redirected too many times");
    }

    static String read(InputStream input, int maxBytes) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16 * 1024];
        int n, total = 0;
        while ((n = input.read(buffer)) != -1) {
            total += n;
            if (total > maxBytes) throw new IllegalStateException("The response is too large to load");
            output.write(buffer, 0, n);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }
}
