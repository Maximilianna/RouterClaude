package com.routerclaude.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.routerclaude.config.ClaudeCliConfigIO;
import com.routerclaude.config.DataStore;
import com.routerclaude.config.MetaConfig;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.config.SettingsStore;
import com.routerclaude.model.Provider;
import com.routerclaude.model.UsageRecord;
import com.routerclaude.model.cli.ClaudeCliProvider;
import com.routerclaude.service.UsageService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

@Component
public class ProxyServer {

    private static final Logger log = LoggerFactory.getLogger(ProxyServer.class);
    private static final String CLAUDE_PREFIX = "claude-";
    private static final int DEFAULT_PORT = 8901;

    private final int port;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private HttpServer server;
    private final ProviderConfigIO providerConfigIO = new ProviderConfigIO();
    private final ClaudeCliConfigIO cliConfigIO = new ClaudeCliConfigIO();
    private final MetaConfig metaConfig = new MetaConfig();
    private final SettingsStore settingsStore = new SettingsStore();
    private final UsageService usageService;

    private static final int MAX_LOGS = 500;
    private final ConcurrentLinkedDeque<ProxyLogEntry> logs = new ConcurrentLinkedDeque<>();
    private final DataStore<ProxyLogEntry> logStore = new DataStore<>("logs.json", new TypeReference<>() {});
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong errorRequests = new AtomicLong(0);
    private volatile String startupError = null;

    private record CacheEntry(byte[] body, int statusCode, long expireAt) {}
    private record NonStreamingResult(byte[] body, int statusCode) {}
    private final ConcurrentHashMap<String, CacheEntry> responseCache = new ConcurrentHashMap<>();

    @Autowired
    public ProxyServer(UsageService usageService) {
        this.port = DEFAULT_PORT;
        this.usageService = usageService;
    }

    public ProxyServer(int port, UsageService usageService) {
        this.port = port;
        this.usageService = usageService;
    }

    @PostConstruct
    public void start() {
        // Load persisted logs
        List<ProxyLogEntry> persisted = logStore.load();
        long total = 0;
        long errors = 0;
        for (ProxyLogEntry entry : persisted) {
            logs.addLast(entry);
            total++;
            if (entry.isError()) errors++;
        }
        totalRequests.set(total);
        errorRequests.set(errors);
        if (!persisted.isEmpty()) {
            log.info("Loaded {} persisted proxy logs", persisted.size());
        }

        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            server.createContext("/v1/messages", this::handleForward);
            server.createContext("/v1/complete", this::handleForward);
            server.createContext("/v1/models", this::handleModels);
            server.start();
            startupError = null;
            log.info("Proxy server started on port {}", port);
        } catch (Exception e) {
            startupError = e.getMessage();
            log.error("Failed to start proxy server on port {}: {}", port, e.getMessage());
        }
    }

    @PreDestroy
    public void stop() {
        flushLogs();
        if (server != null) {
            server.stop(0);
            log.info("Proxy server stopped");
        }
    }

    private void handleForward(HttpExchange exchange) {
        long startTime = System.currentTimeMillis();
        String modelName = "unknown";
        String providerName = "unknown";
        int statusCode = 502;
        boolean isError = true;

        try {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                respond(exchange, 405, "{\"error\":\"仅支持 POST 方法\"}");
                return;
            }

            byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
            String body = new String(bodyBytes, StandardCharsets.UTF_8);

            JsonNode root = mapper.readTree(body);
            JsonNode modelNode = root.get("model");
            if (modelNode == null || modelNode.asText().isBlank()) {
                respond(exchange, 400, "{\"error\":\"请求体中缺少 model 字段\"}");
                return;
            }

            String ccdModelName = modelNode.asText();
            modelName = ccdModelName;

            // Try proxy token auth first, fall back to model-based lookup
            String proxyToken = extractProxyToken(exchange);
            Provider provider = null;
            if (proxyToken != null) {
                provider = findProviderByToken(proxyToken);
                if (provider == null) {
                    respond(exchange, 401, "{\"error\":\"代理 Token 无效\"}");
                    return;
                }
            }
            if (provider == null) {
                provider = findProviderForModel(ccdModelName);
            }
            if (provider == null) {
                respond(exchange, 404, "{\"error\":\"模型未找到或供应商未配置\"}");
                return;
            }
            providerName = provider.getName();

            String targetPath = exchange.getRequestURI().getPath();
            String targetUrl = provider.getApiUrl().replaceAll("/+$", "") + targetPath;
            String actualModelName = ccdModelName.startsWith(CLAUDE_PREFIX)
                    ? ccdModelName.substring(CLAUDE_PREFIX.length())
                    : ccdModelName;

            ((ObjectNode) root).put("model", actualModelName);
            String modifiedBody = mapper.writeValueAsString(root);

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .header("Accept", "application/json, text/event-stream")
                    .timeout(Duration.ofSeconds(60));

            boolean isStreaming = root.has("stream") && root.get("stream").asBoolean(false);

            reqBuilder.POST(HttpRequest.BodyPublishers.ofString(modifiedBody));

            if (isStreaming) {
                statusCode = handleStreamingWithRetry(exchange, reqBuilder, actualModelName, providerName);
                isError = statusCode < 200 || statusCode >= 400;
            } else {
                // Check cache for non-streaming requests
                String cacheKey = null;
                if (isCacheEnabled()) {
                    cacheKey = computeCacheKey(modifiedBody);
                    CacheEntry cached = getFromCache(cacheKey);
                    if (cached != null) {
                        exchange.getResponseHeaders().set("Content-Type", "application/json");
                        exchange.getResponseHeaders().set("X-Cache", "HIT");
                        exchange.sendResponseHeaders(cached.statusCode(), cached.body().length);
                        exchange.getResponseBody().write(cached.body());
                        exchange.getResponseBody().close();
                        statusCode = cached.statusCode();
                        isError = false;
                        return;
                    }
                }

                NonStreamingResult result = handleNonStreamingWithRetry(reqBuilder, actualModelName, providerName);
                statusCode = result.statusCode();
                isError = statusCode < 200 || statusCode >= 400;

                // Store in cache if successful
                if (isCacheEnabled() && cacheKey != null && statusCode >= 200 && statusCode < 300) {
                    putToCache(cacheKey, result.body(), result.statusCode());
                    exchange.getResponseHeaders().set("X-Cache", "MISS");
                }

                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(result.statusCode(), result.body().length);
                exchange.getResponseBody().write(result.body());
                exchange.getResponseBody().close();
            }

        } catch (Exception e) {
            log.error("Proxy error", e);
            if (!exchange.getResponseHeaders().containsKey("Content-type")) {
                respond(exchange, 502, "{\"error\":\"供应商 API 请求失败\"}");
            }
        } finally {
            long latency = System.currentTimeMillis() - startTime;
            totalRequests.incrementAndGet();
            if (isError) errorRequests.incrementAndGet();
            addLog(new ProxyLogEntry(System.currentTimeMillis(), modelName, providerName, statusCode, latency, isError));
        }
    }

    private boolean isRetryable(int statusCode) {
        return statusCode >= 500 && statusCode < 600;
    }

    private int getMaxRetries() {
        Object val = settingsStore.load().get("retryMaxAttempts");
        if (val instanceof Number n) return n.intValue();
        return 3;
    }

    private long getRetryDelayMs() {
        Object val = settingsStore.load().get("retryDelayMs");
        if (val instanceof Number n) return n.longValue();
        return 1000;
    }

    private boolean isCacheEnabled() {
        Object val = settingsStore.load().get("cacheEnabled");
        if (val instanceof Boolean b) return b;
        return true;
    }

    private long getCacheTtlMs() {
        Object val = settingsStore.load().get("cacheTtlMs");
        if (val instanceof Number n) return n.longValue();
        return 300000;
    }

    private int getCacheMaxEntries() {
        Object val = settingsStore.load().get("cacheMaxEntries");
        if (val instanceof Number n) return n.intValue();
        return 200;
    }

    private String computeCacheKey(String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(body.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return String.valueOf(body.hashCode());
        }
    }

    private CacheEntry getFromCache(String key) {
        CacheEntry entry = responseCache.get(key);
        if (entry != null && System.currentTimeMillis() < entry.expireAt()) {
            return entry;
        }
        if (entry != null) {
            responseCache.remove(key);
        }
        return null;
    }

    private void putToCache(String key, byte[] body, int statusCode) {
        if (responseCache.size() >= getCacheMaxEntries()) {
            String eldest = responseCache.keySet().iterator().next();
            responseCache.remove(eldest);
        }
        long ttl = getCacheTtlMs();
        responseCache.put(key, new CacheEntry(body, statusCode, System.currentTimeMillis() + ttl));
    }

    private NonStreamingResult handleNonStreamingWithRetry(HttpRequest.Builder reqBuilder,
                                              String modelName, String providerName) throws Exception {
        int maxRetries = getMaxRetries();
        long retryDelayMs = getRetryDelayMs();
        Exception lastException = null;
        int lastStatus = 0;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                log.info("Retrying non-streaming request (attempt {}/{}) after {}ms, model={}",
                        attempt, maxRetries, retryDelayMs, modelName);
                Thread.sleep(retryDelayMs);
            }

            try {
                HttpResponse<String> response = httpClient.send(
                        reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

                int code = response.statusCode();
                if (!isRetryable(code) || attempt == maxRetries) {
                    if (usageService != null) {
                        try {
                            JsonNode root = mapper.readTree(response.body());
                            JsonNode usage = root.get("usage");
                            if (usage != null) {
                                int prompt = usage.has("prompt_tokens") ? usage.get("prompt_tokens").asInt() : 0;
                                int completion = usage.has("completion_tokens") ? usage.get("completion_tokens").asInt() : 0;
                                int total = usage.has("total_tokens") ? usage.get("total_tokens").asInt() : prompt + completion;
                                usageService.record(new UsageRecord(
                                        System.currentTimeMillis(), providerName, modelName, prompt, completion, total));
                            }
                        } catch (Exception ignored) {
                        }
                    }

                    byte[] respBytes = response.body().getBytes(StandardCharsets.UTF_8);
                    return new NonStreamingResult(respBytes, code);
                }

                lastStatus = code;
                log.warn("Got retryable status {} for model={}, attempt {}/{}", code, modelName, attempt + 1, maxRetries + 1);

            } catch (java.net.http.HttpTimeoutException e) {
                lastException = e;
                log.warn("Request timeout for model={}, attempt {}/{}", modelName, attempt + 1, maxRetries + 1);
                if (attempt == maxRetries) throw e;
            } catch (java.net.ConnectException e) {
                lastException = e;
                log.warn("Connection failed for model={}, attempt {}/{}", modelName, attempt + 1, maxRetries + 1);
                if (attempt == maxRetries) throw e;
            }
        }

        if (lastException != null) throw lastException;
        return new NonStreamingResult(new byte[0], lastStatus);
    }

    private int handleStreamingWithRetry(HttpExchange exchange, HttpRequest.Builder reqBuilder,
                                          String modelName, String providerName) throws Exception {
        int maxRetries = getMaxRetries();
        long retryDelayMs = getRetryDelayMs();
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                log.info("Retrying streaming request (attempt {}/{}) after {}ms, model={}",
                        attempt, maxRetries, retryDelayMs, modelName);
                Thread.sleep(retryDelayMs);
            }

            try {
                HttpResponse<java.io.InputStream> response = httpClient.send(
                        reqBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());

                int respStatus = response.statusCode();
                if (isRetryable(respStatus) && attempt < maxRetries) {
                    log.warn("Got retryable status {} for streaming model={}, attempt {}/{}",
                            respStatus, modelName, attempt + 1, maxRetries + 1);
                    response.body().close();
                    lastException = null;
                    continue;
                }

                // Non-retryable or last attempt — stream to client
                return streamToClient(exchange, response, modelName, providerName);

            } catch (java.net.http.HttpTimeoutException e) {
                lastException = e;
                log.warn("Streaming request timeout for model={}, attempt {}/{}", modelName, attempt + 1, maxRetries + 1);
                if (attempt == maxRetries) throw e;
            } catch (java.net.ConnectException e) {
                lastException = e;
                log.warn("Streaming connection failed for model={}, attempt {}/{}", modelName, attempt + 1, maxRetries + 1);
                if (attempt == maxRetries) throw e;
            }
        }

        if (lastException != null) throw lastException;
        return 502;
    }

    private int streamToClient(HttpExchange exchange, HttpResponse<java.io.InputStream> response,
                                String modelName, String providerName) throws Exception {
        int respStatus = response.statusCode();
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
        exchange.getResponseHeaders().set("Cache-Control", "no-cache");
        exchange.getResponseHeaders().set("Connection", "keep-alive");
        exchange.sendResponseHeaders(respStatus, 0);

        StringBuilder lineBuf = new StringBuilder();
        StringBuilder dataBuf = new StringBuilder();
        int lastPromptTokens = 0;
        int lastCompletionTokens = 0;

        try (OutputStream os = exchange.getResponseBody();
             java.io.InputStream is = response.body()) {
            byte[] rawBuf = new byte[8192];
            int n;
            while ((n = is.read(rawBuf)) != -1) {
                os.write(rawBuf, 0, n);
                os.flush();

                for (int i = 0; i < n; i++) {
                    char c = (char) rawBuf[i];
                    if (c == '\n') {
                        String line = lineBuf.toString();
                        lineBuf.setLength(0);

                        if (line.startsWith("data: ")) {
                            dataBuf.append(line.substring(6));
                        } else if (line.isEmpty()) {
                            if (!dataBuf.isEmpty()) {
                                try {
                                    JsonNode eventNode = mapper.readTree(dataBuf.toString());
                                    JsonNode usage = eventNode.get("usage");
                                    if (usage != null) {
                                        if (usage.has("input_tokens")) lastPromptTokens = usage.get("input_tokens").asInt();
                                        if (usage.has("output_tokens")) lastCompletionTokens = usage.get("output_tokens").asInt();
                                    }
                                } catch (Exception ignored) {
                                }
                                dataBuf.setLength(0);
                            }
                        } else if (!line.startsWith("event: ")) {
                            dataBuf.append(line);
                        }
                    } else if (c != '\r') {
                        lineBuf.append(c);
                    }
                }
            }
        }

        if (usageService != null && (lastPromptTokens > 0 || lastCompletionTokens > 0)) {
            int total = lastPromptTokens + lastCompletionTokens;
            usageService.record(new UsageRecord(
                    System.currentTimeMillis(), providerName, modelName,
                    lastPromptTokens, lastCompletionTokens, total));
        }

        return respStatus;
    }

    private void handleModels(HttpExchange exchange) {
        try {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                respond(exchange, 405, "{\"error\":\"仅支持 GET 方法\"}");
                return;
            }

            List<Provider> providers = providerConfigIO.listAll();
            Provider active = providers.stream()
                    .filter(Provider::isEnabled)
                    .findFirst().orElse(null);

            ArrayNode models = mapper.createArrayNode();
            if (active != null && active.getModels() != null) {
                active.getModels().forEach(m -> {
                    ObjectNode node = mapper.createObjectNode();
                    node.put("id", CLAUDE_PREFIX + m.getName());
                    node.put("object", "model");
                    node.put("created", System.currentTimeMillis() / 1000);
                    node.put("owned_by", active.getName());
                    models.add(node);
                });
            }

            ObjectNode resp = mapper.createObjectNode();
            resp.set("data", models);
            String json = mapper.writeValueAsString(resp);
            respond(exchange, 200, json);

        } catch (Exception e) {
            log.error("Models endpoint error", e);
            respond(exchange, 500, "{\"error\":\"获取模型列表失败\"}");
        }
    }

    private String extractProxyToken(HttpExchange exchange) {
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7).trim();
            if (token.startsWith("rc_")) {
                return token;
            }
        }
        return null;
    }

    private Provider findProviderByToken(String proxyToken) throws Exception {
        // Check CCD providers
        List<Provider> providers = providerConfigIO.listAll();
        for (Provider p : providers) {
            if (proxyToken.equals(p.getProxyToken())) {
                return p;
            }
        }
        // Check CLI providers
        try {
            List<ClaudeCliProvider> cliProviders = cliConfigIO.listAll();
            for (ClaudeCliProvider cp : cliProviders) {
                if (proxyToken.equals(cp.getProxyToken())) {
                    // Convert CLI provider to Provider for proxy forwarding
                    Provider p = new Provider();
                    p.setName(cp.getName());
                    p.setApiUrl(cp.getBaseUrl());
                    p.setApiKey(cp.getAuthToken());
                    return p;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to check CLI providers: {}", e.getMessage());
        }
        return null;
    }

    private Provider findProviderForModel(String ccdModelName) throws Exception {
        List<Provider> providers = providerConfigIO.listAll();
        String strippedName = ccdModelName.startsWith(CLAUDE_PREFIX)
                ? ccdModelName.substring(CLAUDE_PREFIX.length())
                : ccdModelName;

        // First try the enabled provider
        for (Provider p : providers) {
            if (p.isEnabled() && p.getModels() != null) {
                boolean hasModel = p.getModels().stream()
                        .anyMatch(m -> m.getName().equals(strippedName));
                if (hasModel) return p;
            }
        }

        // Fall back to any provider that has this model
        for (Provider p : providers) {
            if (p.getModels() != null) {
                boolean hasModel = p.getModels().stream()
                        .anyMatch(m -> m.getName().equals(strippedName));
                if (hasModel) return p;
            }
        }
        return null;
    }

    public Map<String, Object> getStatus() {
        long total = totalRequests.get();
        long errors = errorRequests.get();
        double errorRate = total > 0 ? (double) errors / total : 0.0;
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("running", server != null && startupError == null);
        status.put("port", port);
        status.put("totalRequests", total);
        status.put("errorRate", Math.round(errorRate * 100.0) / 100.0);
        if (startupError != null) {
            status.put("startupError", startupError);
        }
        return status;
    }

    public List<ProxyLogEntry> getLogs(int limit) {
        return logs.stream().limit(limit).toList();
    }

    private void addLog(ProxyLogEntry entry) {
        logs.addFirst(entry);
        while (logs.size() > MAX_LOGS) {
            logs.removeLast();
        }
        flushLogs();
    }

    private void flushLogs() {
        try {
            logStore.save(List.copyOf(logs));
        } catch (Exception e) {
            log.error("Failed to flush proxy logs", e);
        }
    }

    private void respond(HttpExchange exchange, int code, String body) {
        try {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(code, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.getResponseBody().close();
        } catch (Exception e) {
            log.error("Failed to send response", e);
        }
    }
}
