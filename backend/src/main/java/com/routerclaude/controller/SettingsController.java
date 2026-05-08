package com.routerclaude.controller;

import com.routerclaude.config.SettingsStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsStore settingsStore = new SettingsStore();

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(settingsStore.load());
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> settings) throws IOException {
        Map<String, Object> current = settingsStore.load();
        current.putAll(settings);
        settingsStore.save(current);
        return ResponseEntity.ok(current);
    }
}
