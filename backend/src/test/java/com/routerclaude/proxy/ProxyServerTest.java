package com.routerclaude.proxy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.routerclaude.config.MetaConfig;
import org.junit.jupiter.api.*;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

class ProxyServerTest {

    private static final ObjectMapper mapper = new ObjectMapper();
    private static final HttpClient httpClient = HttpClient.newHttpClient();
    private static final String PROVIDER_UUID = UUID.randomUUID().toString();

    private static com.sun.net.httpserver.HttpServer mockProvider;
    private static int mockPort;

    private ProxyServer proxy;
    private int proxyPort;
    private Path tempDir;

    @BeforeAll
    static void startMockProvider() throws Exception {
        mockProvider = com.sun.net.httpserver.HttpServer.create(new InetSocketAddress(0), 0);
        mockProvider.setExecutor(Executors.newSingleThreadExecutor());
        mockPort = mockProvider.getAddress().getPort();

        mockProvider.createContext("/v1/messages", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String response = mapper.writeValueAsString(
                    mapper.createObjectNode()
                            .put("model", mapper.readTree(body).get("model").asText())
                            .put("auth_header", exchange.getRequestHeaders().getFirst("Authorization"))
                            .put("content_type", exchange.getRequestHeaders().getFirst("Content-Type")));
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            byte[] resp = response.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, resp.length);
            exchange.getResponseBody().write(resp);
            exchange.getResponseBody().close();
        });

        mockProvider.createContext("/v1/complete", exchange -> {
            exchange.sendResponseHeaders(200, -1);
            exchange.getResponseBody().close();
        });

        mockProvider.start();
    }

    @AfterAll
    static void stopMockProvider() {
        if (mockProvider != null) mockProvider.stop(0);
    }

    @BeforeEach
    void setUp() throws Exception {
        tempDir = Path.of(System.getProperty("java.io.tmpdir"), "rc-test-" + System.nanoTime());
        tempDir.toFile().mkdirs();
        System.setProperty("ccd.config.dir", tempDir.toString());

        // Create a provider with a real UUID (required by isValidUuidFile filter)
        MetaConfig meta = new MetaConfig();
        meta.setAppliedId(PROVIDER_UUID);
        meta.upsertEntry(PROVIDER_UUID, "TestProvider");

        var ccdConfig = new com.routerclaude.model.ccd.CcdProviderConfig();
        ccdConfig.setInferenceProvider("gateway");
        ccdConfig.setInferenceGatewayBaseUrl("http://127.0.0.1:" + mockPort);
        ccdConfig.setInferenceGatewayApiKey("sk-test-key");
        ccdConfig.setInferenceModels(java.util.List.of(
                new com.routerclaude.model.ccd.CcdModel("claude-test-model", true)));

        mapper.writeValue(tempDir.resolve(PROVIDER_UUID + ".json").toFile(), ccdConfig);
        Thread.sleep(100);

        proxyPort = findFreePort();
        proxy = new ProxyServer(proxyPort);
        proxy.start();
    }

    @AfterEach
    void tearDown() {
        if (proxy != null) proxy.stop();
        System.clearProperty("ccd.config.dir");
        deleteDir(tempDir);
    }

    private static int findFreePort() throws Exception {
        try (var s = new java.net.ServerSocket(0)) {
            return s.getLocalPort();
        }
    }

    private static void deleteDir(Path dir) {
        if (dir.toFile().exists()) {
            var files = dir.toFile().listFiles();
            if (files != null) for (var f : files) f.delete();
            dir.toFile().delete();
        }
    }

    @Test
    void forwardRequestStripsClaudePrefix() throws Exception {
        String reqBody = "{\"model\":\"claude-test-model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}";

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/messages"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode(), "body=" + response.body());
        var json = mapper.readTree(response.body());
        assertEquals("test-model", json.get("model").asText());
        assertEquals("Bearer sk-test-key", json.get("auth_header").asText());
    }

    @Test
    void returns404ForUnknownModel() throws Exception {
        String reqBody = "{\"model\":\"claude-nonexistent\"}";
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/messages"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(404, response.statusCode());
    }

    @Test
    void returns400ForMissingModelField() throws Exception {
        String reqBody = "{\"foo\":\"bar\"}";
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/messages"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(400, response.statusCode());
    }

    @Test
    void getModelsReturnsEnabledProviderModels() throws Exception {
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/models"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode());
        var json = mapper.readTree(response.body());
        var data = json.get("data");
        assertNotNull(data);
        assertTrue(data.isArray());
        assertEquals(1, data.size());
        assertEquals("claude-test-model", data.get(0).get("id").asText());
    }

    @Test
    void methodNotAllowedOnModels() throws Exception {
        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/models"))
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(405, response.statusCode());
    }

    @Test
    void forwardsCompleteEndpoint() throws Exception {
        String reqBody = "{\"model\":\"claude-test-model\",\"prompt\":\"Hello\"}";

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/complete"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode(), "body=" + response.body());
    }

    @Test
    void streamingRequestStillForwards() throws Exception {
        String reqBody = "{\"model\":\"claude-test-model\",\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}]}";

        var response = httpClient.send(
                HttpRequest.newBuilder()
                        .uri(URI.create("http://127.0.0.1:" + proxyPort + "/v1/messages"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(reqBody))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode(), "body=" + response.body());
        var json = mapper.readTree(response.body());
        assertEquals("test-model", json.get("model").asText());
    }
}
