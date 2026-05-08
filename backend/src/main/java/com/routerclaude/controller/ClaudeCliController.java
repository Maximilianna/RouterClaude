package com.routerclaude.controller;

import com.routerclaude.model.cli.ClaudeCliConfig;
import com.routerclaude.model.cli.ClaudeCliProvider;
import com.routerclaude.service.ClaudeCliService;
import com.routerclaude.service.ClaudeCliServiceInterface;
import com.routerclaude.service.ModelDiscoverService;
import com.routerclaude.service.ProviderService;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/claude-cli")
public class ClaudeCliController {

    private final ClaudeCliServiceInterface cliService;
    private final ModelDiscoverService discoverService;

    public ClaudeCliController() {
        this.cliService = new ClaudeCliService();
        this.discoverService = new ModelDiscoverService();
    }

    // Constructor for dependency injection (testing)
    ClaudeCliController(ClaudeCliServiceInterface cliService, ModelDiscoverService discoverService) {
        this.cliService = cliService;
        this.discoverService = discoverService;
    }

    @GetMapping
    public List<ClaudeCliProvider> listProviders() throws IOException {
        return cliService.listProviders();
    }

    @PostMapping
    public ResponseEntity<ClaudeCliProvider> createProvider(@RequestBody ClaudeCliConfig config) throws IOException {
        ClaudeCliProvider created = cliService.createProvider(config);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateProvider(@PathVariable String id, @RequestBody ClaudeCliConfig config) throws IOException {
        cliService.updateProvider(id, config);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProvider(@PathVariable String id) throws IOException {
        cliService.deleteProvider(id);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Void> toggleProvider(@PathVariable String id, @RequestParam boolean enabled) throws IOException {
        cliService.toggleProvider(id, enabled);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClaudeCliProvider> getProvider(@PathVariable String id) throws IOException {
        ClaudeCliProvider provider = cliService.getProvider(id);
        if (provider == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(provider);
    }

    @GetMapping("/active")
    public ResponseEntity<ClaudeCliProvider> getActiveProvider() throws IOException {
        ClaudeCliProvider active = cliService.getActiveProvider();
        if (active == null) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.ok(active);
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<ProviderService.TestResult> testConnection(@PathVariable String id) throws IOException {
        try {
            ProviderService.TestResult result = cliService.testConnection(id);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(new ProviderService.TestResult(false, e.getMessage(), -1));
        }
    }

    @PostMapping("/discover")
    public ResponseEntity<Map<String, Object>> discoverModels(@RequestBody Map<String, String> body) {
        try {
            String baseUrl = body.get("baseUrl");
            String authToken = body.get("authToken");
            String apiMode = body.get("apiMode");
            List<String> models = discoverService.discoverModels(baseUrl, authToken, apiMode);
            return ResponseEntity.ok(Map.of("models", models));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorderProviders(@RequestBody List<String> ids) throws IOException {
        cliService.reorderProviders(ids);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportProviders() throws IOException {
        List<Map<String, Object>> providers = cliService.exportProviders();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("version", "1.0");
        result.put("exportedAt", java.time.Instant.now().toString());
        result.put("providers", providers);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(result);
    }

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importProviders(@RequestBody Map<String, Object> body) throws IOException {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> providers = (List<Map<String, Object>>) body.get("providers");
        Map<String, Object> result = cliService.importProviders(providers);
        return ResponseEntity.ok(result);
    }
}
