package com.routerclaude.controller;

import com.routerclaude.config.ClaudeCliConfigIO;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.config.SettingsStore;
import com.routerclaude.model.Provider;
import com.routerclaude.model.cli.ClaudeCliProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/lb")
public class LbConfigController {

    private final SettingsStore settingsStore = new SettingsStore();
    private final ProviderConfigIO providerConfigIO = new ProviderConfigIO();
    private final ClaudeCliConfigIO cliConfigIO = new ClaudeCliConfigIO();

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> settings = settingsStore.load();
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("lbEnabled", settings.get("lbEnabled"));
        config.put("lbStrategy", settings.get("lbStrategy"));
        config.put("lbCcdEntries", settings.getOrDefault("lbCcdEntries", List.of()));
        config.put("lbCcEntries", settings.getOrDefault("lbCcEntries", List.of()));
        return ResponseEntity.ok(config);
    }

    @PutMapping("/config")
    public ResponseEntity<Map<String, Object>> updateConfig(@RequestBody Map<String, Object> body) throws IOException {
        Map<String, Object> settings = settingsStore.load();
        if (body.containsKey("lbEnabled")) settings.put("lbEnabled", body.get("lbEnabled"));
        if (body.containsKey("lbStrategy")) settings.put("lbStrategy", body.get("lbStrategy"));
        if (body.containsKey("lbCcdEntries")) settings.put("lbCcdEntries", body.get("lbCcdEntries"));
        if (body.containsKey("lbCcEntries")) settings.put("lbCcEntries", body.get("lbCcEntries"));
        settingsStore.save(settings);
        return ResponseEntity.ok(settings);
    }

    @GetMapping("/providers")
    public ResponseEntity<List<Map<String, Object>>> getProviders(@RequestParam String type) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        if ("ccd".equals(type)) {
            for (Provider p : providerConfigIO.listAll()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", p.getId());
                item.put("name", p.getName());
                item.put("enabled", p.isEnabled());
                List<String> models = new ArrayList<>();
                if (p.getModels() != null) {
                    for (var m : p.getModels()) {
                        models.add(m.getName());
                    }
                }
                item.put("models", models);
                result.add(item);
            }
        } else if ("cc".equals(type)) {
            for (ClaudeCliProvider cp : cliConfigIO.listAll()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", cp.getId());
                item.put("name", cp.getName());
                item.put("enabled", cp.isEnabled());
                List<String> models = new ArrayList<>();
                if (cp.getDefaultModel() != null && !cp.getDefaultModel().isBlank()) models.add(cp.getDefaultModel());
                if (cp.getDefaultSonnetModel() != null && !cp.getDefaultSonnetModel().isBlank()) models.add(cp.getDefaultSonnetModel());
                if (cp.getDefaultOpusModel() != null && !cp.getDefaultOpusModel().isBlank()) models.add(cp.getDefaultOpusModel());
                if (cp.getDefaultHaikuModel() != null && !cp.getDefaultHaikuModel().isBlank()) models.add(cp.getDefaultHaikuModel());
                item.put("models", models);
                result.add(item);
            }
        }
        return ResponseEntity.ok(result);
    }
}
