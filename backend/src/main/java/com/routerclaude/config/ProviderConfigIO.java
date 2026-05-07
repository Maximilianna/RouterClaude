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
        return CcdConfigDir.getPath().resolve(uuid + ".json");
    }

    private boolean isValidUuidFile(Path path) {
        String name = path.getFileName().toString();
        return name.endsWith(".json")
                && !name.equals("_meta.json")
                && name.length() == 41; // uuid(36) + ".json"(5) = 41
    }

    /**
     * Scans the CCD config directory and returns all providers.
     * Reads _meta.json for entry metadata and appliedId, then loads each {uuid}.json.
     */
    public List<Provider> listAll() throws IOException {
        MetaConfig metaConfig = new MetaConfig();
        CcdMeta meta = metaConfig.read();

        // Build id→name lookup and id→order index from entries
        Map<String, String> nameMap = new HashMap<>();
        Map<String, Integer> orderMap = new HashMap<>();
        for (int i = 0; i < meta.getEntries().size(); i++) {
            CcdMetaEntry entry = meta.getEntries().get(i);
            nameMap.put(entry.getId(), entry.getName());
            orderMap.put(entry.getId(), i);
        }

        Path dir = CcdConfigDir.getPath();
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
                providers.add(provider);
            }
        }

        // Sort by the order stored in _meta.json entries
        providers.sort(Comparator.comparingInt(p ->
                orderMap.getOrDefault(p.getId(), Integer.MAX_VALUE)));

        return providers;
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

        // Convert and write the CCD config
        CcdProviderConfig ccdConfig = convertToCcdConfig(config);
        mapper.writeValue(getProviderFilePath(uuid).toFile(), ccdConfig);

        // Update _meta.json
        metaConfig.upsertEntry(uuid, config.getName());

        Provider provider = new Provider();
        provider.setId(uuid);
        provider.setName(config.getName());
        provider.setApiUrl(config.getApiUrl());
        provider.setApiKey(config.getApiKey());
        provider.setModels(config.getModels());
        provider.setEnabled(false);
        return provider;
    }

    /**
     * Updates an existing provider config.
     */
    public void update(String uuid, ProviderConfig config) throws IOException {
        MetaConfig metaConfig = new MetaConfig();

        // Update CCD config file
        CcdProviderConfig ccdConfig = convertToCcdConfig(config);
        mapper.writeValue(getProviderFilePath(uuid).toFile(), ccdConfig);

        // Update name in _meta.json
        metaConfig.upsertEntry(uuid, config.getName());
    }

    /**
     * Deletes a provider config file and its _meta.json entry.
     */
    public void delete(String uuid) throws IOException {
        MetaConfig metaConfig = new MetaConfig();

        // Delete the config file
        File file = getProviderFilePath(uuid).toFile();
        if (file.exists()) file.delete();

        // Remove from _meta.json
        metaConfig.removeEntry(uuid);
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
