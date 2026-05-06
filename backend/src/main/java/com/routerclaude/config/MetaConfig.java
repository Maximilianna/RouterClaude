package com.routerclaude.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.routerclaude.model.ccd.CcdMeta;
import com.routerclaude.model.ccd.CcdMetaEntry;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;

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
        return CcdConfigDir.getPath().resolve(FILE_NAME);
    }

    /**
     * Reads _meta.json and returns the parsed CcdMeta.
     * Returns an empty CcdMeta if the file does not exist.
     */
    public CcdMeta read() throws IOException {
        File file = getMetaFilePath().toFile();
        if (!file.exists()) {
            return new CcdMeta();
        }
        return mapper.readValue(file, CcdMeta.class);
    }

    /**
     * Writes the CcdMeta to _meta.json.
     * Creates parent directories and file if they don't exist.
     */
    public void write(CcdMeta meta) throws IOException {
        File file = getMetaFilePath().toFile();
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
     */
    public void upsertEntry(String id, String name) throws IOException {
        CcdMeta meta = read();
        // Remove existing entry with same id
        meta.getEntries().removeIf(e -> e.getId().equals(id));
        meta.getEntries().add(new CcdMetaEntry(id, name));
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
