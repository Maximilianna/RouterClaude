package com.routerclaude.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.routerclaude.model.ccd.CcdMeta;
import com.routerclaude.model.ccd.CcdMetaEntry;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * Reads and writes CCD's _meta.json file.
 *
 * _meta.json is the registry of all providers and tracks which one is active (appliedId).
 */
public class MetaConfig {

    private static final String FILE_NAME = "_meta.json";
    private final ObjectMapper mapper;

    public MetaConfig() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public Path getMetaFilePath() {
        return CcdConfigDir.getCcdConfigPath().resolve(FILE_NAME);
    }

    private Path getCcdMetaFilePath() {
        return CcdConfigDir.getCcdPath().resolve(FILE_NAME);
    }

    /**
     * Reads _meta.json and returns the parsed CcdMeta.
     * Reads from primary dir first, falls back to CCD dir for migration.
     * Returns an empty CcdMeta if neither exists.
     */
    public CcdMeta read() throws IOException {
        File file = getMetaFilePath().toFile();
        if (file.exists()) {
            return mapper.readValue(file, CcdMeta.class);
        }
        // Fallback: try reading from CCD dir (first-run migration)
        File ccdFile = getCcdMetaFilePath().toFile();
        if (ccdFile.exists()) {
            CcdMeta meta = mapper.readValue(ccdFile, CcdMeta.class);
            // Migrate: write to primary dir
            write(meta);
            return meta;
        }
        return new CcdMeta();
    }

    /**
     * Writes the CcdMeta to _meta.json.
     * Writes to both primary dir and CCD dir.
     */
    public void write(CcdMeta meta) throws IOException {
        writeToFile(getMetaFilePath().toFile(), meta);
        writeToFile(getCcdMetaFilePath().toFile(), meta);
    }

    private void writeToFile(File file, CcdMeta meta) throws IOException {
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        mapper.writeValue(file, meta);
    }

    /**
     * Returns the currently active provider ID, or null if none is set.
     */
    public String getAppliedId() throws IOException {
        return read().getAppliedId();
    }

    /**
     * Sets the active provider ID.
     */
    public void setAppliedId(String providerId) throws IOException {
        CcdMeta meta = read();
        meta.setAppliedId(providerId);
        write(meta);
    }

    /**
     * Adds or updates an entry in the _meta.json entries list.
     * Preserves existing tags if the entry already exists.
     */
    public void upsertEntry(String id, String name) throws IOException {
        upsertEntry(id, name, null);
    }

    /**
     * Adds or updates an entry with explicit tags.
     * If tags is null, preserves existing tags; otherwise uses the provided tags.
     */
    public void upsertEntry(String id, String name, List<String> tags) throws IOException {
        CcdMeta meta = read();
        List<String> effectiveTags = tags;
        if (effectiveTags == null) {
            // Preserve existing tags
            effectiveTags = meta.getEntries().stream()
                    .filter(e -> e.getId().equals(id))
                    .findFirst()
                    .map(CcdMetaEntry::getTags)
                    .orElse(null);
        }
        meta.getEntries().removeIf(e -> e.getId().equals(id));
        CcdMetaEntry entry = new CcdMetaEntry(id, name);
        entry.setTags(effectiveTags);
        meta.getEntries().add(entry);
        write(meta);
    }

    /**
     * Removes an entry from _meta.json by id.
     * If the removed entry was the active one, appliedId is cleared.
     */
    public void removeEntry(String id) throws IOException {
        CcdMeta meta = read();
        meta.getEntries().removeIf(e -> e.getId().equals(id));
        if (id.equals(meta.getAppliedId())) {
            meta.setAppliedId(null);
        }
        write(meta);
    }
}
