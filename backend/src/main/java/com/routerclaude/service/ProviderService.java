package com.routerclaude.service;

import com.routerclaude.config.MetaConfig;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import com.routerclaude.model.ccd.CcdMeta;
import com.routerclaude.model.ccd.CcdMetaEntry;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

public class ProviderService implements ProviderServiceInterface {

    private final ProviderConfigIO providerConfigIO;
    private final MetaConfig metaConfig;

    public ProviderService() {
        this.providerConfigIO = new ProviderConfigIO();
        this.metaConfig = new MetaConfig();
    }

    public List<Provider> listProviders() throws IOException {
        return providerConfigIO.listAll();
    }

    public Provider getProvider(String id) throws IOException {
        return providerConfigIO.getById(id);
    }

    public Provider createProvider(ProviderConfig config) throws IOException {
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        List<Provider> existing = providerConfigIO.listAll();
        boolean nameTaken = existing.stream()
                .anyMatch(p -> p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        return providerConfigIO.create(config);
    }

    public void updateProvider(String id, ProviderConfig config) throws IOException {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }

        List<Provider> all = providerConfigIO.listAll();
        boolean nameTaken = all.stream()
                .anyMatch(p -> !p.getId().equals(id) && p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        providerConfigIO.update(id, config);
    }

    public void deleteProvider(String id) throws IOException {
        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }
        providerConfigIO.delete(id);
    }

    public void toggleProvider(String id, boolean enabled) throws IOException {
        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }

        if (enabled) {
            metaConfig.setAppliedId(id);
        } else {
            metaConfig.setAppliedId(null);
        }
    }

    public Provider getActiveProvider() throws IOException {
        String appliedId = metaConfig.getAppliedId();
        if (appliedId == null) return null;
        return providerConfigIO.getById(appliedId);
    }

    public TestResult testConnection(String id) throws IOException {
        Provider provider = providerConfigIO.getById(id);
        if (provider == null) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }

        String baseUrl = provider.getApiUrl().replaceAll("/+$", "");
        String testUrl = baseUrl.endsWith("/v1") ? baseUrl + "/models" : baseUrl + "/v1/models";

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(testUrl))
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .header("Content-Type", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(15))
                    .build();

            long startTime = System.currentTimeMillis();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            long latency = System.currentTimeMillis() - startTime;

            int code = response.statusCode();
            if (code >= 200 && code < 500) {
                return new TestResult(true, "SUCCESS", latency);
            } else {
                return new TestResult(false, "FAILED_HTTP:" + code, latency);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceException("INTERRUPTED");
        } catch (java.net.ConnectException e) {
            throw new ServiceException("SERVER_UNREACHABLE");
        } catch (java.net.http.HttpTimeoutException e) {
            throw new ServiceException("TIMEOUT");
        } catch (Exception e) {
            throw new ServiceException("ERROR:" + e.getMessage());
        }
    }

    public void reorderProviders(List<String> ids) throws IOException {
        MetaConfig metaConfig = new MetaConfig();
        CcdMeta meta = metaConfig.read();

        // Reorder entries based on the provided IDs
        List<CcdMetaEntry> reorderedEntries = new ArrayList<>();
        for (String id : ids) {
            meta.getEntries().stream()
                    .filter(e -> e.getId().equals(id))
                    .findFirst()
                    .ifPresent(reorderedEntries::add);
        }
        meta.setEntries(reorderedEntries);
        metaConfig.write(meta);
    }

    public List<Map<String, Object>> exportProviders() throws IOException {
        List<Provider> providers = providerConfigIO.listAll();
        return providers.stream().map(p -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("name", p.getName());
            map.put("apiUrl", p.getApiUrl());
            map.put("apiKey", p.getApiKey());
            map.put("apiMode", p.getApiMode());
            map.put("models", p.getModels());
            if (p.getTags() != null && !p.getTags().isEmpty()) {
                map.put("tags", p.getTags());
            }
            return map;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> importProviders(List<Map<String, Object>> providers) throws IOException {
        if (providers == null || providers.isEmpty()) {
            throw new ServiceException("IMPORT_EMPTY");
        }

        List<Provider> existing = providerConfigIO.listAll();
        Set<String> existingNames = existing.stream()
                .map(Provider::getName)
                .collect(Collectors.toSet());

        int imported = 0;
        int skipped = 0;
        List<String> importedNames = new ArrayList<>();

        for (Map<String, Object> item : providers) {
            String name = (String) item.get("name");
            if (name == null || name.isBlank()) {
                skipped++;
                continue;
            }

            // Skip if name already exists
            if (existingNames.contains(name)) {
                skipped++;
                continue;
            }

            String apiUrl = (String) item.get("apiUrl");
            String apiKey = (String) item.get("apiKey");
            String apiMode = (String) item.get("apiMode");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> modelMaps = (List<Map<String, Object>>) item.get("models");
            @SuppressWarnings("unchecked")
            List<String> tags = (List<String>) item.get("tags");

            List<com.routerclaude.model.Model> models = new ArrayList<>();
            if (modelMaps != null) {
                for (Map<String, Object> mm : modelMaps) {
                    String modelName = (String) mm.get("name");
                    boolean supports1m = Boolean.TRUE.equals(mm.get("supports1m"));
                    if (modelName != null && !modelName.isBlank()) {
                        models.add(new com.routerclaude.model.Model(modelName, supports1m));
                    }
                }
            }

            ProviderConfig config = new ProviderConfig();
            config.setName(name);
            config.setApiUrl(apiUrl);
            config.setApiKey(apiKey);
            config.setApiMode(apiMode);
            config.setModels(models);
            config.setTags(tags);

            try {
                providerConfigIO.create(config);
                existingNames.add(name);
                importedNames.add(name);
                imported++;
            } catch (Exception e) {
                skipped++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("imported", imported);
        result.put("skipped", skipped);
        result.put("names", importedNames);
        return result;
    }

    private void validateConfig(ProviderConfig config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new ServiceException("NAME_REQUIRED");
        }
        if (config.getApiUrl() == null || config.getApiUrl().isBlank()) {
            throw new ServiceException("API_URL_REQUIRED");
        }
        if (!config.getApiUrl().matches("^https?://.+")) {
            throw new ServiceException("API_URL_INVALID");
        }
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new ServiceException("API_KEY_REQUIRED");
        }
        if (config.getModels() == null || config.getModels().isEmpty()) {
            throw new ServiceException("MODELS_REQUIRED");
        }
    }

    public record TestResult(boolean success, String message, long latencyMs) {}
}
