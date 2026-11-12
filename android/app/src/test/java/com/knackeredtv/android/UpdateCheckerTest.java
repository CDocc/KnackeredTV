package com.knackeredtv.android;

import static org.junit.Assert.*;
import java.util.Arrays;
import org.junit.Test;

public class UpdateCheckerTest {
    private static UpdateChecker.Release release(String version) {
        return new UpdateChecker.Release(version, "v" + version, "v" + version, "", "", "");
    }

    @Test public void comparesVersionsNumerically() {
        assertTrue(UpdateChecker.compare("0.10.0", "0.9.0") > 0);
        assertTrue(UpdateChecker.compare("v0.2.0", "0.3.0") < 0);
        assertEquals(0, UpdateChecker.compare("v1.0", "1.0.0"));
        assertTrue(UpdateChecker.compare("1.0.0-beta", "1.0.0") < 0);
        assertEquals(0, UpdateChecker.compare("nightly", "1.0.0"));
    }

    @Test public void dropsDownloadInstructionsFromNotes() {
        assertEquals("- one\n- two", UpdateChecker.notes("- one\r\n- two\n\n<!-- downloads -->\n## Which file do I download?\nstuff"));
        assertEquals("- old", UpdateChecker.notes("- old\n\n## Which file do I download?\n| a | b |"));
    }

    @Test public void reportsOnlyNewerReleases() {
        UpdateChecker.Result result = UpdateChecker.evaluate("0.2.0",
                Arrays.asList(release("0.3.0"), release("0.2.1"), release("0.2.0"), release("0.1.0")));
        assertTrue(result.updateAvailable());
        assertEquals("0.3.0", result.latest);
        assertEquals(2, result.newer.size());
        assertEquals("0.2.0", result.currentRelease.version);
    }

    @Test public void upToDateWhenRunningTheLatest() {
        UpdateChecker.Result result = UpdateChecker.evaluate("0.3.0", Arrays.asList(release("0.3.0"), release("0.2.0")));
        assertFalse(result.updateAvailable());
        assertEquals("0.3.0", result.currentRelease.version);
    }
}
