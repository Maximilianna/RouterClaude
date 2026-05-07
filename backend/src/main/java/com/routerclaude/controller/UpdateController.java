package com.routerclaude.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/update")
public class UpdateController {

    private static final Logger log = LoggerFactory.getLogger(UpdateController.class);
    private static final String RELEASES_URL = "https://api.github.com/repos/Maximilianna/RouterClaude/releases/latest";
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @GetMapping("/check")
    public Map<String, Object> checkUpdate(@RequestParam String currentVersion) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RELEASES_URL))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "RouterClaude")
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("GitHub API returned {}: {}", response.statusCode(), response.body());
                result.put("latestVersion", null);
                result.put("error", "GitHub API returned " + response.statusCode());
                return result;
            }

            JsonNode root = mapper.readTree(response.body());
            String tagName = root.has("tag_name") ? root.get("tag_name").asText() : "";
            String latestVersion = tagName.replaceFirst("^v", "");
            String releaseNotes = root.has("body") ? root.get("body").asText() : "";
            String htmlUrl = root.has("html_url") ? root.get("html_url").asText() : "";

            // Find MSI download URL
            String downloadUrl = null;
            if (root.has("assets")) {
                for (JsonNode asset : root.get("assets")) {
                    String name = asset.has("name") ? asset.get("name").asText() : "";
                    if (name.endsWith(".msi")) {
                        downloadUrl = asset.has("browser_download_url") ? asset.get("browser_download_url").asText() : null;
                        break;
                    }
                }
            }

            boolean hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

            if (hasUpdate) {
                result.put("latestVersion", latestVersion);
                result.put("downloadUrl", downloadUrl);
                result.put("releaseNotes", releaseNotes);
                result.put("htmlUrl", htmlUrl);
            } else {
                result.put("latestVersion", null);
            }
        } catch (Exception e) {
            log.error("Failed to check for updates", e);
            result.put("latestVersion", null);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * Compares two version strings (e.g. "1.0.1" vs "1.1.0").
     * Returns positive if v1 > v2, negative if v1 < v2, 0 if equal.
     */
    static int compareVersions(String v1, String v2) {
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        int len = Math.max(parts1.length, parts2.length);
        for (int i = 0; i < len; i++) {
            int n1 = i < parts1.length ? parseInt(parts1[i]) : 0;
            int n2 = i < parts2.length ? parseInt(parts2[i]) : 0;
            if (n1 != n2) return n1 - n2;
        }
        return 0;
    }

    private static int parseInt(String s) {
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
