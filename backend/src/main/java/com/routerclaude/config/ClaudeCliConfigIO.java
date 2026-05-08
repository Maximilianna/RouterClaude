package com.routerclaude.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.routerclaude.model.cli.ClaudeCliConfig;
import com.routerclaude.model.cli.ClaudeCliMeta;
import com.routerclaude.model.cli.ClaudeCliMetaEntry;
import com.routerclaude.model.cli.ClaudeCliProvider;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Stream;

public class ClaudeCliConfigIO {

    private static final String META_FILE_NAME = "_meta.json";
    private static final String SETTINGS_FILE_PROPERTY = "claude.settings.path";
    private static final String PROXY_URL = "http://127.0.0.1:8901";
    private final ObjectMapper mapper;

    public ClaudeCliConfigIO() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    private String generateProxyToken() {
        return "rc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }

    private Path getConfigDir() {
        return CcdConfigDir.getClaudeCliConfigPath();
    }

    private Path getMetaFilePath() {
        return getConfigDir().resolve(META_FILE_NAME);
    }

    private Path getProviderFilePath(String uuid) {
        return getConfigDir().resolve(uuid + ".json");
    }

    private Path getSettingsJsonPath() {
        String override = System.getProperty(SETTINGS_FILE_PROPERTY);
        if (override != null && !override.isEmpty()) {
            return Path.of(override);
        }
        return Path.of(System.getProperty("user.home"), ".claude", "settings.json");
    }

    private boolean isValidUuidFile(Path path) {
        String name = path.getFileName().toString();
        return name.endsWith(".json")
                && !name.equals(META_FILE_NAME)
                && name.length() == 41;
    }

    // --- Meta helpers ---

    private ClaudeCliMeta readMeta() throws IOException {
        File file = getMetaFilePath().toFile();
        if (file.exists()) {
            return mapper.readValue(file, ClaudeCliMeta.class);
        }
        return new ClaudeCliMeta();
    }

    private void writeMeta(ClaudeCliMeta meta) throws IOException {
        File file = getMetaFilePath().toFile();
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        mapper.writeValue(file, meta);
    }

    // --- CRUD ---

    public List<ClaudeCliProvider> listAll() throws IOException {
        ClaudeCliMeta meta = readMeta();

        Map<String, String> nameMap = new HashMap<>();
        Map<String, Integer> orderMap = new HashMap<>();
        Map<String, List<String>> tagsMap = new HashMap<>();
        for (int i = 0; i < meta.getEntries().size(); i++) {
            ClaudeCliMetaEntry entry = meta.getEntries().get(i);
            nameMap.put(entry.getId(), entry.getName());
            orderMap.put(entry.getId(), i);
            if (entry.getTags() != null) {
                tagsMap.put(entry.getId(), entry.getTags());
            }
        }

        Path dir = getConfigDir();
        if (!Files.isDirectory(dir)) {
            return Collections.emptyList();
        }

        List<ClaudeCliProvider> providers = new ArrayList<>();
        boolean needsMigration = false;
        try (Stream<Path> files = Files.list(dir)) {
            for (Path file : (Iterable<Path>) files::iterator) {
                if (!isValidUuidFile(file)) continue;

                String uuid = file.getFileName().toString().replace(".json", "");
                Map<String, String> envVars = mapper.readValue(file.toFile(),
                        new TypeReference<Map<String, String>>() {});

                // Migration: generate proxy token for existing providers
                if (!envVars.containsKey("_proxyToken")) {
                    String proxyToken = generateProxyToken();
                    envVars.put("_proxyToken", proxyToken);
                    envVars.put("_providerBaseUrl", envVars.getOrDefault("ANTHROPIC_BASE_URL", ""));
                    envVars.put("_providerAuthToken", envVars.getOrDefault("ANTHROPIC_AUTH_TOKEN", ""));
                    envVars.put("ANTHROPIC_BASE_URL", PROXY_URL);
                    envVars.put("ANTHROPIC_AUTH_TOKEN", proxyToken);
                    writeProviderFile(uuid, envVars);
                    needsMigration = true;
                }

                ClaudeCliProvider provider = convertToProvider(uuid, nameMap.get(uuid), envVars);
                provider.setEnabled(uuid.equals(meta.getAppliedId()));
                provider.setTags(tagsMap.getOrDefault(uuid, Collections.emptyList()));
                providers.add(provider);
            }
        }

        providers.sort(Comparator.comparingInt(p ->
                orderMap.getOrDefault(p.getId(), Integer.MAX_VALUE)));

        return providers;
    }

    public ClaudeCliProvider getById(String uuid) throws IOException {
        ClaudeCliMeta meta = readMeta();
        File file = getProviderFilePath(uuid).toFile();
        if (!file.exists()) return null;

        String name = meta.getEntries().stream()
                .filter(e -> e.getId().equals(uuid))
                .map(ClaudeCliMetaEntry::getName)
                .findFirst().orElse(null);

        Map<String, String> envVars = mapper.readValue(file, new TypeReference<>() {});
        ClaudeCliProvider provider = convertToProvider(uuid, name, envVars);
        provider.setEnabled(uuid.equals(meta.getAppliedId()));
        return provider;
    }

    public ClaudeCliProvider create(ClaudeCliConfig config) throws IOException {
        String uuid = UUID.randomUUID().toString();
        String proxyToken = generateProxyToken();
        Map<String, String> envVars = convertToEnvVars(config, proxyToken);
        writeProviderFile(uuid, envVars);

        ClaudeCliMeta meta = readMeta();
        meta.getEntries().removeIf(e -> e.getId().equals(uuid));
        ClaudeCliMetaEntry entry = new ClaudeCliMetaEntry(uuid, config.getName());
        entry.setTags(config.getTags());
        meta.getEntries().add(entry);
        writeMeta(meta);

        ClaudeCliProvider provider = new ClaudeCliProvider();
        provider.setId(uuid);
        provider.setName(config.getName());
        provider.setBaseUrl(config.getBaseUrl());
        provider.setAuthToken(config.getAuthToken());
        provider.setApiMode(config.getApiMode());
        provider.setProxyToken(proxyToken);
        provider.setDefaultModel(config.getDefaultModel());
        provider.setDefaultSonnetModel(config.getDefaultSonnetModel());
        provider.setDefaultOpusModel(config.getDefaultOpusModel());
        provider.setDefaultHaikuModel(config.getDefaultHaikuModel());
        provider.setDefaultModel1m(config.isDefaultModel1m());
        provider.setDefaultSonnetModel1m(config.isDefaultSonnetModel1m());
        provider.setDefaultOpusModel1m(config.isDefaultOpusModel1m());
        provider.setDefaultHaikuModel1m(config.isDefaultHaikuModel1m());
        provider.setTags(config.getTags());
        provider.setEnabled(false);
        return provider;
    }

    public void update(String uuid, ClaudeCliConfig config) throws IOException {
        // Read existing file to preserve proxy token
        Map<String, String> existing = mapper.readValue(getProviderFilePath(uuid).toFile(),
                new TypeReference<>() {});
        String proxyToken = existing.getOrDefault("_proxyToken", generateProxyToken());
        Map<String, String> envVars = convertToEnvVars(config, proxyToken);
        writeProviderFile(uuid, envVars);

        ClaudeCliMeta meta = readMeta();
        meta.getEntries().removeIf(e -> e.getId().equals(uuid));
        ClaudeCliMetaEntry entry = new ClaudeCliMetaEntry(uuid, config.getName());
        entry.setTags(config.getTags());
        meta.getEntries().add(entry);
        writeMeta(meta);
    }

    public void delete(String uuid) throws IOException {
        ClaudeCliMeta meta = readMeta();
        boolean wasActive = uuid.equals(meta.getAppliedId());

        File file = getProviderFilePath(uuid).toFile();
        if (file.exists()) file.delete();

        meta.getEntries().removeIf(e -> e.getId().equals(uuid));
        if (wasActive) {
            meta.setAppliedId(null);
            clearEnvFromSettingsJson();
        }
        writeMeta(meta);
    }

    // --- Toggle (activate/deactivate) ---

    public void toggleProvider(String uuid, boolean enabled) throws IOException {
        ClaudeCliMeta meta = readMeta();

        if (enabled) {
            // Disable any currently active provider
            meta.setAppliedId(uuid);
            writeMeta(meta);

            // Write env to settings.json
            ClaudeCliProvider provider = getById(uuid);
            if (provider != null) {
                writeToSettingsJson(provider);
            }
        } else {
            if (uuid.equals(meta.getAppliedId())) {
                meta.setAppliedId(null);
                writeMeta(meta);
                clearEnvFromSettingsJson();
            }
        }
    }

    // --- Reorder ---

    public void reorderProviders(List<String> ids) throws IOException {
        ClaudeCliMeta meta = readMeta();
        List<ClaudeCliMetaEntry> reordered = new ArrayList<>();
        for (String id : ids) {
            meta.getEntries().stream()
                    .filter(e -> e.getId().equals(id))
                    .findFirst()
                    .ifPresent(reordered::add);
        }
        // Add any entries not in the provided list (safety)
        for (ClaudeCliMetaEntry entry : meta.getEntries()) {
            if (ids.stream().noneMatch(id -> id.equals(entry.getId()))) {
                reordered.add(entry);
            }
        }
        meta.setEntries(reordered);
        writeMeta(meta);
    }

    // --- Export / Import ---

    public List<Map<String, Object>> exportProviders() throws IOException {
        List<ClaudeCliProvider> providers = listAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (ClaudeCliProvider p : providers) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("name", p.getName());
            map.put("baseUrl", p.getBaseUrl());
            map.put("authToken", p.getAuthToken());
            map.put("apiMode", p.getApiMode());
            map.put("defaultModel", p.getDefaultModel());
            map.put("defaultSonnetModel", p.getDefaultSonnetModel());
            map.put("defaultOpusModel", p.getDefaultOpusModel());
            map.put("defaultHaikuModel", p.getDefaultHaikuModel());
            map.put("defaultModel1m", p.isDefaultModel1m());
            map.put("defaultSonnetModel1m", p.isDefaultSonnetModel1m());
            map.put("defaultOpusModel1m", p.isDefaultOpusModel1m());
            map.put("defaultHaikuModel1m", p.isDefaultHaikuModel1m());
            map.put("tags", p.getTags());
            result.add(map);
        }
        return result;
    }

    public Map<String, Object> importProviders(List<Map<String, Object>> providers) throws IOException {
        List<ClaudeCliProvider> existing = listAll();
        Set<String> existingNames = new HashSet<>();
        for (ClaudeCliProvider p : existing) {
            existingNames.add(p.getName());
        }

        int imported = 0;
        int skipped = 0;
        List<String> names = new ArrayList<>();

        for (Map<String, Object> item : providers) {
            String name = (String) item.get("name");
            if (name == null || name.isBlank() || existingNames.contains(name)) {
                skipped++;
                continue;
            }
            ClaudeCliConfig config = new ClaudeCliConfig();
            config.setName(name);
            config.setBaseUrl((String) item.get("baseUrl"));
            config.setAuthToken((String) item.get("authToken"));
            config.setApiMode((String) item.get("apiMode"));
            config.setDefaultModel((String) item.get("defaultModel"));
            config.setDefaultSonnetModel((String) item.get("defaultSonnetModel"));
            config.setDefaultOpusModel((String) item.get("defaultOpusModel"));
            config.setDefaultHaikuModel((String) item.get("defaultHaikuModel"));
            config.setDefaultModel1m(Boolean.TRUE.equals(item.get("defaultModel1m")));
            config.setDefaultSonnetModel1m(Boolean.TRUE.equals(item.get("defaultSonnetModel1m")));
            config.setDefaultOpusModel1m(Boolean.TRUE.equals(item.get("defaultOpusModel1m")));
            config.setDefaultHaikuModel1m(Boolean.TRUE.equals(item.get("defaultHaikuModel1m")));
            if (item.get("tags") instanceof List<?> tags) {
                config.setTags(tags.stream().map(Object::toString).toList());
            }
            create(config);
            existingNames.add(name);
            names.add(name);
            imported++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("names", names);
        return result;
    }

    // --- Settings.json read/write ---

    public Map<String, Object> readSettingsJson() throws IOException {
        Path settingsPath = getSettingsJsonPath();
        File file = settingsPath.toFile();
        if (!file.exists()) {
            return new LinkedHashMap<>();
        }
        return mapper.readValue(file, new TypeReference<>() {});
    }

    private void writeToSettingsJson(ClaudeCliProvider provider) throws IOException {
        Map<String, Object> settings = readSettingsJson();

        Map<String, String> env = new LinkedHashMap<>();
        env.put("ANTHROPIC_BASE_URL", PROXY_URL);
        env.put("ANTHROPIC_AUTH_TOKEN", provider.getProxyToken());
        if (provider.getDefaultModel() != null && !provider.getDefaultModel().isBlank()) {
            String model = provider.getDefaultModel() + (provider.isDefaultModel1m() ? "[1M]" : "");
            env.put("ANTHROPIC_MODEL", model);
        }
        if (provider.getDefaultSonnetModel() != null && !provider.getDefaultSonnetModel().isBlank()) {
            String model = provider.getDefaultSonnetModel() + (provider.isDefaultSonnetModel1m() ? "[1M]" : "");
            env.put("ANTHROPIC_DEFAULT_SONNET_MODEL", model);
        }
        if (provider.getDefaultOpusModel() != null && !provider.getDefaultOpusModel().isBlank()) {
            String model = provider.getDefaultOpusModel() + (provider.isDefaultOpusModel1m() ? "[1M]" : "");
            env.put("ANTHROPIC_DEFAULT_OPUS_MODEL", model);
        }
        if (provider.getDefaultHaikuModel() != null && !provider.getDefaultHaikuModel().isBlank()) {
            String model = provider.getDefaultHaikuModel() + (provider.isDefaultHaikuModel1m() ? "[1M]" : "");
            env.put("ANTHROPIC_DEFAULT_HAIKU_MODEL", model);
        }

        settings.put("env", env);
        writeSettingsJson(settings);
    }

    private void clearEnvFromSettingsJson() throws IOException {
        Map<String, Object> settings = readSettingsJson();
        settings.remove("env");
        writeSettingsJson(settings);
    }

    private void writeSettingsJson(Map<String, Object> settings) throws IOException {
        Path settingsPath = getSettingsJsonPath();
        File file = settingsPath.toFile();
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        mapper.writeValue(file, settings);
    }

    // --- Internal helpers ---

    private void writeProviderFile(String uuid, Map<String, String> envVars) throws IOException {
        File file = getProviderFilePath(uuid).toFile();
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        mapper.writeValue(file, envVars);
    }

    private ClaudeCliProvider convertToProvider(String uuid, String name, Map<String, String> envVars) {
        ClaudeCliProvider provider = new ClaudeCliProvider();
        provider.setId(uuid);
        provider.setName(name);
        if (envVars != null) {
            provider.setBaseUrl(envVars.getOrDefault("_providerBaseUrl",
                    envVars.getOrDefault("ANTHROPIC_BASE_URL", "")));
            provider.setAuthToken(envVars.getOrDefault("_providerAuthToken",
                    envVars.getOrDefault("ANTHROPIC_AUTH_TOKEN", "")));
            provider.setProxyToken(envVars.get("_proxyToken"));
            provider.setApiMode(envVars.get("_apiMode"));
            provider.setDefaultModel(envVars.get("ANTHROPIC_MODEL"));
            provider.setDefaultSonnetModel(envVars.get("ANTHROPIC_DEFAULT_SONNET_MODEL"));
            provider.setDefaultOpusModel(envVars.get("ANTHROPIC_DEFAULT_OPUS_MODEL"));
            provider.setDefaultHaikuModel(envVars.get("ANTHROPIC_DEFAULT_HAIKU_MODEL"));
            provider.setDefaultModel1m("true".equals(envVars.get("_defaultModel1m")));
            provider.setDefaultSonnetModel1m("true".equals(envVars.get("_defaultSonnetModel1m")));
            provider.setDefaultOpusModel1m("true".equals(envVars.get("_defaultOpusModel1m")));
            provider.setDefaultHaikuModel1m("true".equals(envVars.get("_defaultHaikuModel1m")));
        }
        return provider;
    }

    private Map<String, String> convertToEnvVars(ClaudeCliConfig config, String proxyToken) {
        Map<String, String> envVars = new LinkedHashMap<>();
        // Real values (internal)
        envVars.put("_providerBaseUrl", config.getBaseUrl());
        envVars.put("_providerAuthToken", config.getAuthToken());
        envVars.put("_proxyToken", proxyToken);
        if (config.getApiMode() != null) {
            envVars.put("_apiMode", config.getApiMode());
        }
        // Proxy values (written to settings.json)
        envVars.put("ANTHROPIC_BASE_URL", PROXY_URL);
        envVars.put("ANTHROPIC_AUTH_TOKEN", proxyToken);
        envVars.put("ANTHROPIC_MODEL", config.getDefaultModel());
        envVars.put("ANTHROPIC_DEFAULT_SONNET_MODEL", config.getDefaultSonnetModel());
        envVars.put("ANTHROPIC_DEFAULT_OPUS_MODEL", config.getDefaultOpusModel());
        envVars.put("ANTHROPIC_DEFAULT_HAIKU_MODEL", config.getDefaultHaikuModel());
        if (config.isDefaultModel1m()) envVars.put("_defaultModel1m", "true");
        if (config.isDefaultSonnetModel1m()) envVars.put("_defaultSonnetModel1m", "true");
        if (config.isDefaultOpusModel1m()) envVars.put("_defaultOpusModel1m", "true");
        if (config.isDefaultHaikuModel1m()) envVars.put("_defaultHaikuModel1m", "true");
        return envVars;
    }
}
