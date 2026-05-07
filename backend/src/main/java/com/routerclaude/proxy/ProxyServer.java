package com.routerclaude.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.routerclaude.config.DataStore;
import com.routerclaude.config.MetaConfig;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.model.Provider;
import com.routerclaude.model.UsageRecord;
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
import java.time.Duration;
import java.util.*;
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
    private final MetaConfig metaConfig = new MetaConfig();
    private final UsageService usageService;

    private static final int MAX_LOGS = 500;
    private final ConcurrentLinkedDeque<ProxyLogEntry> logs = new ConcurrentLinkedDeque<>();
    private final DataStore<ProxyLogEntry> logStore = new DataStore<>("logs.json", new TypeReference<>() {});
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong errorRequests = new AtomicLong(0);
    private volatile String startupError = null;

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
        for (ProxyLogEntry entry : persisted) {
            logs.addLast(entry);
        }
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

            Provider provider = findProviderForModel(ccdModelName);
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

            if (isStreaming) {
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(modifiedBody));
                statusCode = handleStreamingResponse(exchange, reqBuilder, actualModelName, providerName);
                isError = statusCode < 200 || statusCode >= 400;
            } else {
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(modifiedBody));
                statusCode = handleNonStreamingResponse(exchange, reqBuilder, actualModelName, providerName);
                isError = statusCode < 200 || statusCode >= 400;
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

    private int handleStreamingResponse(HttpExchange exchange, HttpRequest.Builder reqBuilder,
                                         String modelName, String providerName) throws Exception {
        HttpResponse<java.io.InputStream> response = httpClient.send(
                reqBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());

        int respStatus = response.statusCode();
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
        exchange.getResponseHeaders().set("Cache-Control", "no-cache");
        exchange.getResponseHeaders().set("Connection", "keep-alive");
        exchange.sendResponseHeaders(respStatus, 0);

        // Buffer for parsing SSE events to extract usage from message_delta
        StringBuilder lineBuf = new StringBuilder();
        StringBuilder dataBuf = new StringBuilder();
        int lastPromptTokens = 0;
        int lastCompletionTokens = 0;

        try (OutputStream os = exchange.getResponseBody();
             java.io.InputStream is = response.body()) {
            byte[] rawBuf = new byte[8192];
            int n;
            while ((n = is.read(rawBuf)) != -1) {
                // Forward immediately
                os.write(rawBuf, 0, n);
                os.flush();

                // Parse SSE lines to extract usage
                for (int i = 0; i < n; i++) {
                    char c = (char) rawBuf[i];
                    if (c == '\n') {
                        String line = lineBuf.toString();
                        lineBuf.setLength(0);

                        if (line.startsWith("data: ")) {
                            dataBuf.append(line.substring(6));
                        } else if (line.isEmpty()) {
                            // End of SSE event — parse accumulated data
                            if (!dataBuf.isEmpty()) {
                                try {
                                    JsonNode eventNode = mapper.readTree(dataBuf.toString());
                                    String type = eventNode.has("type") ? eventNode.get("type").asText() : "";
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
                            // Continuation of data line
                            dataBuf.append(line);
                        }
                    } else if (c != '\r') {
                        lineBuf.append(c);
                    }
                }
            }
        }

        // Record usage if we extracted tokens
        if (usageService != null && (lastPromptTokens > 0 || lastCompletionTokens > 0)) {
            int total = lastPromptTokens + lastCompletionTokens;
            usageService.record(new UsageRecord(
                    System.currentTimeMillis(), providerName, modelName,
                    lastPromptTokens, lastCompletionTokens, total));
        }

        return respStatus;
    }

    private int handleNonStreamingResponse(HttpExchange exchange, HttpRequest.Builder reqBuilder,
                                            String modelName, String providerName) throws Exception {
        HttpResponse<String> response = httpClient.send(
                reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

        // Extract usage data
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
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(response.statusCode(), respBytes.length);
        exchange.getResponseBody().write(respBytes);
        exchange.getResponseBody().close();
        return response.statusCode();
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
