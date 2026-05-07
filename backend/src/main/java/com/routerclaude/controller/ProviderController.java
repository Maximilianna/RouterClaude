package com.routerclaude.controller;

import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import com.routerclaude.service.ProviderService;
import com.routerclaude.service.ProviderServiceInterface;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/providers")
public class ProviderController {

    private final ProviderServiceInterface providerService;

    public ProviderController() {
        this.providerService = new com.routerclaude.service.ProviderService();
    }

    // Constructor for dependency injection (testing)
    ProviderController(ProviderServiceInterface providerService) {
        this.providerService = providerService;
    }

    @GetMapping
    public List<Provider> listProviders() throws IOException {
        return providerService.listProviders();
    }

    @PostMapping
    public ResponseEntity<Provider> createProvider(@RequestBody ProviderConfig config) throws IOException {
        Provider created = providerService.createProvider(config);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateProvider(@PathVariable String id, @RequestBody ProviderConfig config) throws IOException {
        providerService.updateProvider(id, config);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProvider(@PathVariable String id) throws IOException {
        providerService.deleteProvider(id);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<Void> toggleProvider(@PathVariable String id, @RequestParam boolean enabled) throws IOException {
        providerService.toggleProvider(id, enabled);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Provider> getProvider(@PathVariable String id) throws IOException {
        Provider provider = providerService.getProvider(id);
        if (provider == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(provider);
    }

    @GetMapping("/active")
    public ResponseEntity<Provider> getActiveProvider() throws IOException {
        Provider active = providerService.getActiveProvider();
        if (active == null) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.ok(active);
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<ProviderService.TestResult> testConnection(@PathVariable String id) throws IOException {
        try {
            ProviderService.TestResult result = providerService.testConnection(id);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(new ProviderService.TestResult(false, e.getMessage(), -1));
        }
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorderProviders(@RequestBody List<String> ids) throws IOException {
        providerService.reorderProviders(ids);
        return ResponseEntity.ok().build();
    }
}
