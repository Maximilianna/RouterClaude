package com.routerclaude.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.routerclaude.model.Model;
import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import com.routerclaude.model.ccd.CcdMeta;
import com.routerclaude.model.ccd.CcdMetaEntry;
import com.routerclaude.model.ccd.CcdModel;
import com.routerclaude.model.ccd.CcdProviderConfig;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Reads and writes CCD {uuid}.json provider config files.
 * Also handles conversion between CCD format and the internal Provider model.
 */
public class ProviderConfigIO {

    private static final String CCD_PROVIDER_TYPE = "gateway";
    private static final String CLAUDE_PREFIX = "claude-";
    private static final String PROXY_BASE_URL = "http://127.0.0.1:8901";
    private final ObjectMapper mapper;

    public ProviderConfigIO() {
        this.mapper = new ObjectMapper();
        this.mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    private Path getProviderFilePath(String uuid) {
        return CcdConfigDir.getCcdConfigPath().resolve(uuid + ".json");
    }

    private Path getCcdProviderFilePath(String uuid) {
        return CcdConfigDir.getCcdPath().resolve(uuid + ".json");
    }

    private boolean isValidUuidFile(Path path) {
        String name = path.getFileName().toString();
        return name.endsWith(".json")
                && !name.equals("_meta.json")
                && name.length() == 41; // uuid(36) + ".json"(5) = 41
    }

    /**
     * Scans the config directory and returns all providers.
     * Reads from primary dir, falls back to CCD dir for migration.
     */
    public List<Provider> listAll() throws IOException {
        MetaConfig metaConfig = new MetaConfig();
        CcdMeta meta = metaConfig.read();

        Map<String, String> nameMap = new HashMap<>();
        Map<String, Integer> orderMap = new HashMap<>();
        Map<String, List<String>> tagsMap = new HashMap<>();
        for (int i = 0; i < meta.getEntries().size(); i++) {
            CcdMetaEntry entry = meta.getEntries().get(i);
            nameMap.put(entry.getId(), entry.getName());
            orderMap.put(entry.getId(), i);
            if (entry.getTags() != null) {
                tagsMap.put(entry.getId(), entry.getTags());
            }
        }

        // Try primary dir first, fall back to CCD dir
        Path dir = CcdConfigDir.getCcdConfigPath();
        if (!Files.isDirectory(dir)) {
            dir = CcdConfigDir.getCcdPath();
        }
        if (!Files.isDirectory(dir)) {
            return Collections.emptyList();
        }

        List<Provider> providers = new ArrayList<>();
        try (Stream<Path> files = Files.list(dir)) {
            for (Path file : (Iterable<Path>) files::iterator) {
                if (!isValidUuidFile(file)) continue;

                String uuid = file.getFileName().toString().replace(".json", "");
                CcdProviderConfig ccdConfig = mapper.readValue(file.toFile(), CcdProviderConfig.class);
                Provider provider = convertToProvider(uuid, nameMap.get(uuid), ccdConfig);
                provider.setEnabled(uuid.equals(meta.getAppliedId()));
                provider.setTags(tagsMap.getOrDefault(uuid, Collections.emptyList()));
                providers.add(provider);
            }
        }

        // Migrate: if we read from CCD dir, copy all files to primary dir
        if (dir.equals(CcdConfigDir.getCcdPath())) {
            migrateToPrimaryDir(dir);
        }

        providers.sort(Comparator.comparingInt(p ->
                orderMap.getOrDefault(p.getId(), Integer.MAX_VALUE)));

        return providers;
    }

    private void migrateToPrimaryDir(Path sourceDir) {
        try {
            Path targetDir = CcdConfigDir.getCcdConfigPath();
            if (!Files.isDirectory(targetDir)) {
                Files.createDirectories(targetDir);
            }
            try (Stream<Path> files = Files.list(sourceDir)) {
                for (Path file : (Iterable<Path>) files::iterator) {
                    if (!isValidUuidFile(file) && !file.getFileName().toString().equals("_meta.json")) continue;
                    Path target = targetDir.resolve(file.getFileName());
                    Files.copy(file, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }
        } catch (IOException ignored) {
            // Migration is best-effort
        }
    }

    /**
     * Reads a single provider config by UUID.
     */
    public Provider getById(String uuid) throws IOException {
        MetaConfig metaConfig = new MetaConfig();
        CcdMeta meta = metaConfig.read();

        File file = getProviderFilePath(uuid).toFile();
        if (!file.exists()) return null;

        String name = meta.getEntries().stream()
                .filter(e -> e.getId().equals(uuid))
                .map(CcdMetaEntry::getName)
                .findFirst().orElse(null);

        CcdProviderConfig ccdConfig = mapper.readValue(file, CcdProviderConfig.class);
        Provider provider = convertToProvider(uuid, name, ccdConfig);
        provider.setEnabled(uuid.equals(meta.getAppliedId()));
        return provider;
    }

    /**
     * Creates a new provider config file.
     * Returns the generated provider with its UUID.
     */
    public Provider create(ProviderConfig config) throws IOException {
        String uuid = UUID.randomUUID().toString();
        MetaConfig metaConfig = new MetaConfig();

        CcdProviderConfig ccdConfig = convertToCcdConfig(config);
        writeProviderFile(uuid, ccdConfig);

        metaConfig.upsertEntry(uuid, config.getName(), config.getTags());

        Provider provider = new Provider();
        provider.setId(uuid);
        provider.setName(config.getName());
        provider.setApiUrl(config.getApiUrl());
        provider.setApiKey(config.getApiKey());
        provider.setModels(config.getModels());
        provider.setApiMode(config.getApiMode());
        provider.setTags(config.getTags());
        provider.setEnabled(false);
        return provider;
    }

    /**
     * Updates an existing provider config.
     */
    public void update(String uuid, ProviderConfig config) throws IOException {
        MetaConfig metaConfig = new MetaConfig();

        CcdProviderConfig ccdConfig = convertToCcdConfig(config);
        writeProviderFile(uuid, ccdConfig);

        metaConfig.upsertEntry(uuid, config.getName(), config.getTags());
    }

    /**
     * Deletes a provider config file and its _meta.json entry.
     */
    public void delete(String uuid) throws IOException {
        MetaConfig metaConfig = new MetaConfig();

        File file = getProviderFilePath(uuid).toFile();
        if (file.exists()) file.delete();
        File ccdFile = getCcdProviderFilePath(uuid).toFile();
        if (ccdFile.exists()) ccdFile.delete();

        metaConfig.removeEntry(uuid);
    }

    private void writeProviderFile(String uuid, CcdProviderConfig ccdConfig) throws IOException {
        File primaryFile = getProviderFilePath(uuid).toFile();
        File parentDir = primaryFile.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }
        mapper.writeValue(primaryFile, ccdConfig);

        // Sync to CCD dir
        File ccdFile = getCcdProviderFilePath(uuid).toFile();
        File ccdParentDir = ccdFile.getParentFile();
        if (ccdParentDir != null && !ccdParentDir.exists()) {
            ccdParentDir.mkdirs();
        }
        mapper.writeValue(ccdFile, ccdConfig);
    }

    /**
     * Converts a CCD CcdProviderConfig to our internal Provider model.
     * Uses custom fields (_providerApiUrl, _providerApiKey) for the real provider URL and key.
     * Falls back to inferenceGatewayBaseUrl/ApiKey if custom fields are absent.
     * Strips the "claude-" prefix from model names.
     */
    private Provider convertToProvider(String uuid, String name, CcdProviderConfig ccdConfig) {
        Provider provider = new Provider();
        provider.setId(uuid);
        provider.setName(name);
        if (ccdConfig != null) {
            // Read from custom fields first, fall back to standard fields
            String apiUrl = ccdConfig.get_providerApiUrl();
            if (apiUrl == null || apiUrl.isEmpty()) {
                apiUrl = ccdConfig.getInferenceGatewayBaseUrl();
            }
            String apiKey = ccdConfig.get_providerApiKey();
            if (apiKey == null || apiKey.isEmpty()) {
                apiKey = ccdConfig.getInferenceGatewayApiKey();
            }
            provider.setApiUrl(apiUrl);
            provider.setApiKey(apiKey);
            provider.setApiMode(ccdConfig.get_providerApiMode());
            if (ccdConfig.getInferenceModels() != null) {
                provider.setModels(ccdConfig.getInferenceModels().stream()
                        .map(ccdModel -> new Model(
                                stripClaudePrefix(ccdModel.getName()),
                                ccdModel.isSupports1m()))
                        .collect(Collectors.toList()));
            }
        }
        return provider;
    }

    /**
     * Converts internal ProviderConfig to CCD CcdProviderConfig format.
     * - inferenceGatewayBaseUrl is set to the proxy URL so CCD sends requests via the proxy.
     * - The real provider API URL and key are stored in custom fields (_providerApiUrl/_providerApiKey).
     * - Adds the "claude-" prefix to model names so CCD recognizes them.
     */
    private CcdProviderConfig convertToCcdConfig(ProviderConfig config) {
        CcdProviderConfig ccdConfig = new CcdProviderConfig();
        ccdConfig.setInferenceProvider(CCD_PROVIDER_TYPE);
        ccdConfig.setInferenceGatewayBaseUrl(PROXY_BASE_URL);
        ccdConfig.setInferenceGatewayApiKey(config.getApiKey());
        ccdConfig.set_providerApiUrl(config.getApiUrl());
        ccdConfig.set_providerApiKey(config.getApiKey());
        ccdConfig.set_providerApiMode(config.getApiMode());
        ccdConfig.set_providerTags(config.getTags());
        if (config.getModels() != null) {
            ccdConfig.setInferenceModels(config.getModels().stream()
                    .map(model -> new CcdModel(
                            CLAUDE_PREFIX + model.getName(),
                            model.isSupports1m()))
                    .collect(Collectors.toList()));
        }
        return ccdConfig;
    }

    private String stripClaudePrefix(String name) {
        if (name != null && name.startsWith(CLAUDE_PREFIX)) {
            return name.substring(CLAUDE_PREFIX.length());
        }
        return name;
    }
}
