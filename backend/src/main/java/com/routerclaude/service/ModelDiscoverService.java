package com.routerclaude.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class ModelDiscoverService {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public List<String> discoverModels(String apiUrl, String apiKey, String apiMode) throws Exception {
        String baseUrl = apiUrl.replaceAll("/+$", "");
        String modelsUrl = baseUrl.endsWith("/v1") ? baseUrl + "/models" : baseUrl + "/v1/models";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(modelsUrl))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ServiceException("DISCOVER_FAILED:" + response.statusCode());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode data = root.get("data");
        if (data == null || !data.isArray()) {
            throw new ServiceException("DISCOVER_INVALID_RESPONSE");
        }

        List<String> models = new ArrayList<>();
        for (JsonNode node : data) {
            JsonNode idNode = node.get("id");
            if (idNode != null) {
                models.add(idNode.asText());
            }
        }
        return models;
    }
}
