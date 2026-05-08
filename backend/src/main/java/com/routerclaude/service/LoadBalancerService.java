package com.routerclaude.service;

import com.routerclaude.config.ClaudeCliConfigIO;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.config.SettingsStore;
import com.routerclaude.model.Model;
import com.routerclaude.model.Provider;
import com.routerclaude.model.cli.ClaudeCliProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class LoadBalancerService {

    private static final Logger log = LoggerFactory.getLogger(LoadBalancerService.class);
    private static final int UNHEALTHY_THRESHOLD = 3;

    private final ProviderConfigIO providerConfigIO = new ProviderConfigIO();
    private final ClaudeCliConfigIO cliConfigIO = new ClaudeCliConfigIO();
    private final SettingsStore settingsStore = new SettingsStore();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ConcurrentHashMap<String, ProviderHealth> healthMap = new ConcurrentHashMap<>();
    private final AtomicInteger roundRobinCounter = new AtomicInteger(0);
    // Weighted round-robin state
    private volatile String lastWeightedSignature = "";
    private volatile int weightedIdx = 0;
    private volatile int weightedRemaining = 0;

    public static class LbEntry {
        public String providerId;
        public List<String> models;
        public int weight;
    }

    public static class LbResult {
        public final Provider provider;
        public final String selectedModel;
        public LbResult(Provider provider, String selectedModel) {
            this.provider = provider;
            this.selectedModel = selectedModel;
        }
    }

    public static class ProviderHealth {
        public final AtomicBoolean healthy = new AtomicBoolean(true);
        public final AtomicLong avgLatencyMs = new AtomicLong(0);
        public final AtomicInteger consecutiveFailures = new AtomicInteger(0);
        public final AtomicLong lastCheckTime = new AtomicLong(0);
        private final AtomicInteger sampleCount = new AtomicInteger(0);

        public void recordSuccess(long latencyMs) {
            consecutiveFailures.set(0);
            healthy.set(true);
            int count = sampleCount.incrementAndGet();
            long currentAvg = avgLatencyMs.get();
            long newAvg = currentAvg + (latencyMs - currentAvg) / count;
            avgLatencyMs.set(newAvg);
        }

        public void recordFailure() {
            int failures = consecutiveFailures.incrementAndGet();
            if (failures >= UNHEALTHY_THRESHOLD) {
                healthy.set(false);
            }
        }

        public void resetAfterHealthCheck(boolean isSuccess) {
            lastCheckTime.set(System.currentTimeMillis());
            if (isSuccess) {
                consecutiveFailures.set(0);
                healthy.set(true);
            } else {
                recordFailure();
            }
        }
    }

    public ProviderHealth getHealth(String providerId) {
        return healthMap.computeIfAbsent(providerId, k -> new ProviderHealth());
    }

    public boolean isLbEnabled() {
        Object val = settingsStore.load().get("lbEnabled");
        return val instanceof Boolean b && b;
    }

    public String getStrategy() {
        Object val = settingsStore.load().get("lbStrategy");
        return val instanceof String s ? s : "round_robin";
    }

    @SuppressWarnings("unchecked")
    public List<LbEntry> getCcdEntries() {
        Object val = settingsStore.load().get("lbCcdEntries");
        if (val instanceof List<?> list) {
            List<LbEntry> entries = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    LbEntry entry = new LbEntry();
                    entry.providerId = (String) map.get("providerId");
                    entry.models = map.get("models") instanceof List<?> ml
                            ? ml.stream().map(Object::toString).toList() : List.of();
                    entry.weight = map.get("weight") instanceof Number n ? n.intValue() : 1;
                    entries.add(entry);
                }
            }
            return entries;
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    public List<LbEntry> getCcEntries() {
        Object val = settingsStore.load().get("lbCcEntries");
        if (val instanceof List<?> list) {
            List<LbEntry> entries = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    LbEntry entry = new LbEntry();
                    entry.providerId = (String) map.get("providerId");
                    entry.models = map.get("models") instanceof List<?> ml
                            ? ml.stream().map(Object::toString).toList() : List.of();
                    entry.weight = map.get("weight") instanceof Number n ? n.intValue() : 1;
                    entries.add(entry);
                }
            }
            return entries;
        }
        return List.of();
    }

    /**
     * Select a provider from a manual LB group with model rotation.
     * Picks a healthy entry, then randomly selects one of its models.
     * @param entries the LB group entries
     * @param excludeProviderId provider ID to exclude (for failover), or null
     * @return result with provider and selected model, or null if no candidate found
     */
    public LbResult selectFromGroup(List<LbEntry> entries, String excludeProviderId) {
        List<LbEntry> candidates = new ArrayList<>();
        for (LbEntry entry : entries) {
            if (excludeProviderId != null && excludeProviderId.equals(entry.providerId)) continue;
            if (entry.models == null || entry.models.isEmpty()) continue;
            ProviderHealth health = getHealth(entry.providerId);
            if (!health.healthy.get()) continue;
            candidates.add(entry);
        }

        if (candidates.isEmpty()) return null;

        String strategy = getStrategy();
        return switch (strategy) {
            case "weighted" -> selectWeighted(candidates);
            case "lowest_latency" -> selectLowestLatency(candidates);
            default -> selectRoundRobin(candidates);
        };
    }

    private Provider resolveProvider(String providerId) {
        // Try CCD first
        try {
            for (Provider p : providerConfigIO.listAll()) {
                if (p.getId().equals(providerId)) return p;
            }
        } catch (Exception e) {
            log.warn("Failed to list CCD providers: {}", e.getMessage());
        }
        // Try CLI
        try {
            ClaudeCliProvider cp = cliConfigIO.getById(providerId);
            if (cp != null) {
                Provider p = new Provider();
                p.setId(cp.getId());
                p.setName(cp.getName());
                p.setApiUrl(cp.getBaseUrl());
                p.setApiKey(cp.getAuthToken());
                List<Model> models = new ArrayList<>();
                if (cp.getDefaultModel() != null && !cp.getDefaultModel().isBlank())
                    models.add(new Model(cp.getDefaultModel(), cp.isDefaultModel1m()));
                if (cp.getDefaultSonnetModel() != null && !cp.getDefaultSonnetModel().isBlank())
                    models.add(new Model(cp.getDefaultSonnetModel(), cp.isDefaultSonnetModel1m()));
                if (cp.getDefaultOpusModel() != null && !cp.getDefaultOpusModel().isBlank())
                    models.add(new Model(cp.getDefaultOpusModel(), cp.isDefaultOpusModel1m()));
                if (cp.getDefaultHaikuModel() != null && !cp.getDefaultHaikuModel().isBlank())
                    models.add(new Model(cp.getDefaultHaikuModel(), cp.isDefaultHaikuModel1m()));
                p.setModels(models);
                return p;
            }
        } catch (Exception e) {
            log.warn("Failed to resolve CLI provider {}: {}", providerId, e.getMessage());
        }
        return null;
    }

    /**
     * Determine whether a provider ID belongs to a CCD provider.
     */
    public boolean isCcdProvider(String providerId) {
        try {
            for (Provider p : providerConfigIO.listAll()) {
                if (p.getId().equals(providerId)) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private LbResult buildResult(LbEntry entry) {
        Provider p = resolveProvider(entry.providerId);
        if (p == null) return null;
        String model = entry.models.get(ThreadLocalRandom.current().nextInt(entry.models.size()));
        return new LbResult(p, model);
    }

    private LbResult selectRoundRobin(List<LbEntry> candidates) {
        int idx = Math.abs(roundRobinCounter.getAndIncrement() % candidates.size());
        return buildResult(candidates.get(idx));
    }

    /**
     * Deterministic weighted round-robin: weight=2,1 → A,A,B,A,A,B,...
     * Resets state when the candidate list changes.
     */
    private synchronized LbResult selectWeighted(List<LbEntry> candidates) {
        // Build a signature from provider IDs to detect config changes
        String signature = candidates.stream()
                .map(e -> e.providerId + ":" + e.weight)
                .reduce("", (a, b) -> a.isEmpty() ? b : a + "," + b);

        if (!signature.equals(lastWeightedSignature)) {
            lastWeightedSignature = signature;
            weightedIdx = 0;
            weightedRemaining = 0;
        }

        if (weightedRemaining <= 0) {
            weightedRemaining = candidates.get(weightedIdx).weight > 0
                    ? candidates.get(weightedIdx).weight : 1;
        }

        LbEntry selected = candidates.get(weightedIdx);
        weightedRemaining--;

        if (weightedRemaining <= 0) {
            weightedIdx = (weightedIdx + 1) % candidates.size();
        }

        return buildResult(selected);
    }

    private LbResult selectLowestLatency(List<LbEntry> candidates) {
        long minLatency = Long.MAX_VALUE;
        List<LbEntry> best = new ArrayList<>();

        for (LbEntry e : candidates) {
            ProviderHealth health = getHealth(e.providerId);
            long latency = health.avgLatencyMs.get();
            if (latency < minLatency) {
                minLatency = latency;
                best.clear();
                best.add(e);
            } else if (latency == minLatency) {
                best.add(e);
            }
        }
        return buildResult(best.get(ThreadLocalRandom.current().nextInt(best.size())));
    }

    public void recordSuccess(String providerId, long latencyMs) {
        getHealth(providerId).recordSuccess(latencyMs);
    }

    public void recordFailure(String providerId) {
        getHealth(providerId).recordFailure();
    }

    public void checkHealth(Provider provider) {
        ProviderHealth health = getHealth(provider.getId());
        try {
            String url = provider.getApiUrl().replaceAll("/+$", "") + "/v1/models";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            boolean success = response.statusCode() >= 200 && response.statusCode() < 400;
            health.resetAfterHealthCheck(success);
            if (!success) {
                log.warn("Health check failed for provider {}: HTTP {}", provider.getName(), response.statusCode());
            }
        } catch (Exception e) {
            health.resetAfterHealthCheck(false);
            log.warn("Health check failed for provider {}: {}", provider.getName(), e.getMessage());
        }
    }

    public Map<String, ProviderHealth> getAllHealth() {
        return Collections.unmodifiableMap(healthMap);
    }
}
