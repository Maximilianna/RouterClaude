package com.routerclaude.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class SettingsStore {

    private static final Logger log = LoggerFactory.getLogger(SettingsStore.class);
    private static final String FILE_NAME = "settings.json";
    private final ObjectMapper mapper;
    private final Path filePath;

    private static final Map<String, Object> DEFAULTS;
    static {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("retryMaxAttempts", 3);
        m.put("retryDelayMs", 1000);
        m.put("cacheEnabled", true);
        m.put("cacheTtlMs", 300000);
        m.put("cacheMaxEntries", 200);
        m.put("lbEnabled", false);
        m.put("lbStrategy", "round_robin");
        m.put("lbCcdEntries", List.of());
        m.put("lbCcEntries", List.of());
        DEFAULTS = Collections.unmodifiableMap(m);
    }

    public SettingsStore() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.filePath = CcdConfigDir.getPath().resolve("data").resolve(FILE_NAME);
    }

    public Map<String, Object> load() {
        Map<String, Object> settings = new LinkedHashMap<>(DEFAULTS);
        if (!Files.exists(filePath)) {
            return settings;
        }
        try {
            byte[] bytes = Files.readAllBytes(filePath);
            if (bytes.length > 0) {
                Map<String, Object> stored = mapper.readValue(bytes, new TypeReference<>() {});
                settings.putAll(stored);
            }
        } catch (Exception e) {
            log.error("Failed to load {}: {}", filePath, e.getMessage());
        }
        return settings;
    }

    public void save(Map<String, Object> settings) throws IOException {
        Path dir = filePath.getParent();
        if (!Files.isDirectory(dir)) {
            Files.createDirectories(dir);
        }
        mapper.writeValue(filePath.toFile(), settings);
    }
}
