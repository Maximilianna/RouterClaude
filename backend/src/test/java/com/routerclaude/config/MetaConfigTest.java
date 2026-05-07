package com.routerclaude.config;

import com.routerclaude.model.ccd.CcdMeta;
import com.routerclaude.model.ccd.CcdMetaEntry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class MetaConfigTest {

    @TempDir
    Path tempDir;

    private MetaConfig metaConfig;

    @BeforeEach
    void setUp() {
        System.setProperty("routerclaude.config.dir", tempDir.toString());
        System.setProperty("ccd.config.dir", tempDir.toString());
        metaConfig = new MetaConfig();
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("routerclaude.config.dir");
        System.clearProperty("ccd.config.dir");
    }

    @Test
    void readReturnsEmptyMetaWhenFileNotExists() throws Exception {
        CcdMeta meta = metaConfig.read();
        assertNull(meta.getAppliedId());
        assertTrue(meta.getEntries().isEmpty());
    }

    @Test
    void writeAndReadRoundTrip() throws Exception {
        CcdMeta meta = new CcdMeta();
        meta.setAppliedId("uuid-123");
        meta.getEntries().add(new CcdMetaEntry("uuid-123", "TestProvider"));
        meta.getEntries().add(new CcdMetaEntry("uuid-456", "AnotherProvider"));

        metaConfig.write(meta);

        CcdMeta loaded = metaConfig.read();
        assertEquals("uuid-123", loaded.getAppliedId());
        assertEquals(2, loaded.getEntries().size());
        assertEquals("TestProvider", loaded.getEntries().get(0).getName());
        assertEquals("uuid-456", loaded.getEntries().get(1).getId());
    }

    @Test
    void getAppliedIdReturnsNullWhenNotSet() throws Exception {
        assertNull(metaConfig.getAppliedId());
    }

    @Test
    void setAppliedIdUpdatesFile() throws Exception {
        metaConfig.setAppliedId("uuid-789");
        assertEquals("uuid-789", metaConfig.getAppliedId());
    }

    @Test
    void upsertEntryAddsNewEntry() throws Exception {
        metaConfig.upsertEntry("uuid-1", "First");
        CcdMeta meta = metaConfig.read();
        assertEquals(1, meta.getEntries().size());
        assertEquals("First", meta.getEntries().get(0).getName());
    }

    @Test
    void upsertEntryReplacesExistingEntry() throws Exception {
        metaConfig.upsertEntry("uuid-1", "Original");
        metaConfig.upsertEntry("uuid-1", "Updated");
        CcdMeta meta = metaConfig.read();
        assertEquals(1, meta.getEntries().size());
        assertEquals("Updated", meta.getEntries().get(0).getName());
    }

    @Test
    void removeEntryRemovesFromMeta() throws Exception {
        metaConfig.upsertEntry("uuid-1", "First");
        metaConfig.upsertEntry("uuid-2", "Second");
        metaConfig.removeEntry("uuid-1");

        CcdMeta meta = metaConfig.read();
        assertEquals(1, meta.getEntries().size());
        assertEquals("uuid-2", meta.getEntries().get(0).getId());
    }

    @Test
    void removeEntryClearsAppliedIdWhenRemovingActiveProvider() throws Exception {
        metaConfig.setAppliedId("uuid-active");
        metaConfig.upsertEntry("uuid-active", "Active");
        metaConfig.removeEntry("uuid-active");

        CcdMeta meta = metaConfig.read();
        assertNull(meta.getAppliedId());
    }

    @Test
    void removeEntryDoesNotClearAppliedIdWhenRemovingInactiveProvider() throws Exception {
        metaConfig.upsertEntry("uuid-1", "One");
        metaConfig.upsertEntry("uuid-2", "Two");
        metaConfig.setAppliedId("uuid-1");
        metaConfig.removeEntry("uuid-2");

        assertEquals("uuid-1", metaConfig.getAppliedId());
    }
}
