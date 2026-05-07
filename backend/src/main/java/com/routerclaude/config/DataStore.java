package com.routerclaude.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Persists JSON arrays to ~/.routerclaude/data/, separate from CCD config files.
 */
public class DataStore<T> {

    private static final Logger log = LoggerFactory.getLogger(DataStore.class);
    private final ObjectMapper mapper;
    private final Path filePath;
    private final TypeReference<List<T>> typeRef;

    public DataStore(String fileName, TypeReference<List<T>> typeRef) {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.typeRef = typeRef;
        this.filePath = CcdConfigDir.getPath().resolve("data").resolve(fileName);
    }

    public List<T> load() {
        if (!Files.exists(filePath)) {
            return new ArrayList<>();
        }
        try {
            byte[] bytes = Files.readAllBytes(filePath);
            if (bytes.length == 0) return new ArrayList<>();
            List<T> result = mapper.readValue(bytes, typeRef);
            log.info("Loaded {} entries from {}", result.size(), filePath);
            return result;
        } catch (Exception e) {
            log.error("Failed to load {}: {}", filePath, e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    public void save(List<T> data) {
        try {
            Path dir = filePath.getParent();
            if (!Files.isDirectory(dir)) {
                Files.createDirectories(dir);
            }
            mapper.writeValue(filePath.toFile(), data);
            log.debug("Saved {} entries to {}", data.size(), filePath);
        } catch (Exception e) {
            log.error("Failed to save {} ({} entries): {}", filePath, data.size(), e.getMessage(), e);
        }
    }
}
