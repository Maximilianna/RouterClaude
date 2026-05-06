package com.routerclaude.proxy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.routerclaude.config.MetaConfig;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.model.Provider;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.Executors;

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

    public ProxyServer() {
        this.port = DEFAULT_PORT;
    }

    public ProxyServer(int port) {
        this.port = port;
    }

    @PostConstruct
    public void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/v1/messages", this::handleForward);
        server.createContext("/v1/complete", this::handleForward);
        server.createContext("/v1/models", this::handleModels);
        server.start();
        log.info("Proxy server started on port {}", port);
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.stop(0);
            log.info("Proxy server stopped");
        }
    }

    private void handleForward(HttpExchange exchange) {
        try {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                respond(exchange, 405, "{\"error\":\"仅支持 POST 方法\"}");
                return;
            }

            byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
            String body = new String(bodyBytes, StandardCharsets.UTF_8);

            // Parse model name from request body
            JsonNode root = mapper.readTree(body);
            JsonNode modelNode = root.get("model");
            if (modelNode == null || modelNode.asText().isBlank()) {
                respond(exchange, 400, "{\"error\":\"请求体中缺少 model 字段\"}");
                return;
            }

            String ccdModelName = modelNode.asText();

            // Find the enabled provider that has this model
            Provider provider = findProviderForModel(ccdModelName);
            if (provider == null) {
                respond(exchange, 404, "{\"error\":\"模型未找到或供应商未配置\"}");
                return;
            }

            // Resolve target URL and strip claude- prefix from model name
            String targetPath = exchange.getRequestURI().getPath();
            String targetUrl = provider.getApiUrl().replaceAll("/+$", "") + targetPath;
            String actualModelName = ccdModelName.startsWith(CLAUDE_PREFIX)
                    ? ccdModelName.substring(CLAUDE_PREFIX.length())
                    : ccdModelName;

            // Replace model name in the request body
            ((ObjectNode) root).put("model", actualModelName);
            String modifiedBody = mapper.writeValueAsString(root);

            // Build the forwarded request
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .header("Accept", "application/json, text/event-stream")
                    .timeout(Duration.ofSeconds(60));

            boolean isStreaming = root.has("stream") && root.get("stream").asBoolean(false);

            if (isStreaming) {
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(modifiedBody));
                handleStreamingResponse(exchange, reqBuilder);
            } else {
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(modifiedBody));
                handleNonStreamingResponse(exchange, reqBuilder);
            }

        } catch (Exception e) {
            log.error("Proxy error", e);
            if (!exchange.getResponseHeaders().containsKey("Content-type")) {
                respond(exchange, 502, "{\"error\":\"供应商 API 请求失败\"}");
            }
        }
    }

    private void handleStreamingResponse(HttpExchange exchange, HttpRequest.Builder reqBuilder) throws Exception {
        HttpResponse< java.io.InputStream> response = httpClient.send(
                reqBuilder.build(), HttpResponse.BodyHandlers.ofInputStream());

        exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
        exchange.getResponseHeaders().set("Cache-Control", "no-cache");
        exchange.getResponseHeaders().set("Connection", "keep-alive");
        exchange.sendResponseHeaders(response.statusCode(), 0);

        try (OutputStream os = exchange.getResponseBody();
             java.io.InputStream is = response.body()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                os.write(buf, 0, n);
                os.flush();
            }
        }
    }

    private void handleNonStreamingResponse(HttpExchange exchange, HttpRequest.Builder reqBuilder) throws Exception {
        HttpResponse<String> response = httpClient.send(
                reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

        byte[] respBytes = response.body().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(response.statusCode(), respBytes.length);
        exchange.getResponseBody().write(respBytes);
        exchange.getResponseBody().close();
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
