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
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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
