package com.routerclaude.service;

import com.routerclaude.config.ClaudeCliConfigIO;
import com.routerclaude.model.cli.ClaudeCliConfig;
import com.routerclaude.model.cli.ClaudeCliProvider;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

public class ClaudeCliService implements ClaudeCliServiceInterface {

    private final ClaudeCliConfigIO configIO;

    public ClaudeCliService() {
        this.configIO = new ClaudeCliConfigIO();
    }

    @Override
    public List<ClaudeCliProvider> listProviders() throws IOException {
        return configIO.listAll();
    }

    @Override
    public ClaudeCliProvider getProvider(String id) throws IOException {
        return configIO.getById(id);
    }

    @Override
    public ClaudeCliProvider createProvider(ClaudeCliConfig config) throws IOException {
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        List<ClaudeCliProvider> existing = configIO.listAll();
        boolean nameTaken = existing.stream()
                .anyMatch(p -> p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        return configIO.create(config);
    }

    @Override
    public void updateProvider(String id, ClaudeCliConfig config) throws IOException {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        ClaudeCliProvider existing = configIO.getById(id);
        if (existing == null) {
            throw new ServiceException("CLI_PROVIDER_NOT_FOUND");
        }

        List<ClaudeCliProvider> all = configIO.listAll();
        boolean nameTaken = all.stream()
                .anyMatch(p -> !p.getId().equals(id) && p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        configIO.update(id, config);

        // If this provider is active, update settings.json with new config
        if (existing.isEnabled()) {
            ClaudeCliProvider updated = configIO.getById(id);
            if (updated != null) {
                configIO.toggleProvider(id, true);
            }
        }
    }

    @Override
    public void deleteProvider(String id) throws IOException {
        ClaudeCliProvider existing = configIO.getById(id);
        if (existing == null) {
            throw new ServiceException("CLI_PROVIDER_NOT_FOUND");
        }
        configIO.delete(id);
    }

    @Override
    public void toggleProvider(String id, boolean enabled) throws IOException {
        ClaudeCliProvider existing = configIO.getById(id);
        if (existing == null) {
            throw new ServiceException("CLI_PROVIDER_NOT_FOUND");
        }
        configIO.toggleProvider(id, enabled);
    }

    @Override
    public ClaudeCliProvider getActiveProvider() throws IOException {
        List<ClaudeCliProvider> providers = configIO.listAll();
        return providers.stream()
                .filter(ClaudeCliProvider::isEnabled)
                .findFirst()
                .orElse(null);
    }

    @Override
    public ProviderService.TestResult testConnection(String id) throws IOException {
        ClaudeCliProvider provider = configIO.getById(id);
        if (provider == null) {
            throw new ServiceException("CLI_PROVIDER_NOT_FOUND");
        }

        String baseUrl = provider.getBaseUrl().replaceAll("/+$", "");
        String testUrl = baseUrl.endsWith("/v1") ? baseUrl + "/models" : baseUrl + "/v1/models";

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(testUrl))
                    .header("Authorization", "Bearer " + provider.getAuthToken())
                    .header("Content-Type", "application/json")
                    .GET()
                    .timeout(Duration.ofSeconds(15))
                    .build();

            long startTime = System.currentTimeMillis();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            long latency = System.currentTimeMillis() - startTime;

            int code = response.statusCode();
            if (code >= 200 && code < 500) {
                return new ProviderService.TestResult(true, "SUCCESS", latency);
            } else {
                return new ProviderService.TestResult(false, "FAILED_HTTP:" + code, latency);
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

    @Override
    public void reorderProviders(List<String> ids) throws IOException {
        configIO.reorderProviders(ids);
    }

    @Override
    public List<Map<String, Object>> exportProviders() throws IOException {
        return configIO.exportProviders();
    }

    @Override
    public Map<String, Object> importProviders(List<Map<String, Object>> providers) throws IOException {
        if (providers == null || providers.isEmpty()) {
            throw new ServiceException("IMPORT_EMPTY");
        }
        return configIO.importProviders(providers);
    }

    private void validateConfig(ClaudeCliConfig config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new ServiceException("NAME_REQUIRED");
        }
        if (config.getBaseUrl() == null || config.getBaseUrl().isBlank()) {
            throw new ServiceException("BASE_URL_REQUIRED");
        }
        if (!config.getBaseUrl().matches("^https?://.+")) {
            throw new ServiceException("BASE_URL_INVALID");
        }
        if (config.getAuthToken() == null || config.getAuthToken().isBlank()) {
            throw new ServiceException("API_KEY_REQUIRED");
        }
    }
}
