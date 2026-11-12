package com.knackeredtv.android;

import static org.junit.Assert.*;
import java.util.List;
import org.junit.Test;

public class M3uParserTest {
    @Test public void parsesAttributesCommasGroupsAndRelativeUrls() {
        String input = "#EXTM3U\n#EXTINF:-1 tvg-name=\"Fallback\" group-title=\"News, World\",Channel One\n../one.m3u8\n"
                + "#EXTINF:-1 tvg-name=\"Two\",\n#EXTGRP:Sports\nhttps://example.test/two.ts\n";
        List<Channel> channels = M3uParser.parse(input, "https://example.test/lists/list.m3u");
        assertEquals(2, channels.size());
        assertEquals("Channel One", channels.get(0).name);
        assertEquals("News, World", channels.get(0).category);
        assertEquals("https://example.test/one.m3u8", channels.get(0).url);
        assertEquals("Two", channels.get(1).name);
        assertEquals("Sports", channels.get(1).category);
    }

    @Test public void parsesLogoAndFirstGroup() {
        List<Channel> channels = M3uParser.parse(
                "#EXTM3U\n#EXTINF:-1 tvg-logo=\"https://img.test/a.png\" group-title=\"News;Public\",Alpha\nhttps://example.test/a.m3u8\n", null);
        assertEquals(1, channels.size());
        assertEquals("https://img.test/a.png", channels.get(0).logo);
        assertEquals("News", channels.get(0).category);
        assertEquals("News", channels.get(0).categoryId);
    }

    @Test public void skipsUnsupportedAndMalformedEntries() {
        List<Channel> channels = M3uParser.parse(
                "#EXTM3U\n#EXTINF:-1,Bad\nfile:///secret\n#EXTINF:-1,Good\nhttps://example.test/a\n", null);
        assertEquals(1, channels.size());
        assertEquals("Good", channels.get(0).name);
        assertEquals(channels.get(0).id, M3uParser.parse(
                "#EXTINF:-1,Good\nhttps://example.test/a\n", null).get(0).id);
    }
}
