package com.routerclaude.controller;

import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import com.routerclaude.service.ProviderService;
import com.routerclaude.service.ProviderServiceInterface;
import com.routerclaude.service.ServiceException;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory stub for ProviderServiceInterface, used in controller tests.
 * Avoids Mockito/ByteBuddy incompatibility with Java 25.
 */
class StubProviderService implements ProviderServiceInterface {

    final Map<String, Provider> store = new ConcurrentHashMap<>();
    String activeId;

    @Override
    public List<Provider> listProviders() {
        return new ArrayList<>(store.values());
    }

    @Override
    public Provider getProvider(String id) {
        return store.get(id);
    }

    @Override
    public Provider createProvider(ProviderConfig config) {
        boolean nameTaken = store.values().stream()
                .anyMatch(p -> p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        String id = UUID.randomUUID().toString();
        Provider p = new Provider();
        p.setId(id);
        p.setName(config.getName());
        p.setApiUrl(config.getApiUrl());
        p.setApiKey(config.getApiKey());
        p.setModels(config.getModels());
        p.setEnabled(id.equals(activeId));
        store.put(id, p);
        return p;
    }

    @Override
    public void updateProvider(String id, ProviderConfig config) {
        if (!store.containsKey(id)) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }
        boolean nameTaken = store.values().stream()
                .anyMatch(p -> !p.getId().equals(id) && p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("NAME_TAKEN");
        }

        Provider p = store.get(id);
        p.setName(config.getName());
        p.setApiUrl(config.getApiUrl());
        p.setApiKey(config.getApiKey());
        p.setModels(config.getModels());
    }

    @Override
    public void deleteProvider(String id) {
        if (!store.containsKey(id)) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }
        store.remove(id);
        if (id.equals(activeId)) {
            activeId = null;
        }
    }

    @Override
    public void toggleProvider(String id, boolean enabled) {
        if (!store.containsKey(id)) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }
        activeId = enabled ? id : null;
        store.values().forEach(p -> p.setEnabled(p.getId().equals(activeId)));
    }

    @Override
    public Provider getActiveProvider() {
        return activeId != null ? store.get(activeId) : null;
    }

    @Override
    public ProviderService.TestResult testConnection(String id) {
        if (!store.containsKey(id)) {
            throw new ServiceException("PROVIDER_NOT_FOUND");
        }
        return new ProviderService.TestResult(true, "SUCCESS", 100);
    }

    @Override
    public void reorderProviders(List<String> ids) {
        // Reorder in-memory store
        List<Provider> reordered = new ArrayList<>();
        for (String id : ids) {
            Provider p = store.get(id);
            if (p != null) {
                reordered.add(p);
            }
        }
        store.clear();
        for (Provider p : reordered) {
            store.put(p.getId(), p);
        }
    }

    @Override
    public List<Map<String, Object>> exportProviders() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Provider p : store.values()) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("name", p.getName());
            map.put("apiUrl", p.getApiUrl());
            map.put("apiKey", p.getApiKey());
            map.put("apiMode", p.getApiMode());
            map.put("models", p.getModels());
            result.add(map);
        }
        return result;
    }

    @Override
    public Map<String, Object> importProviders(List<Map<String, Object>> providers) {
        int imported = 0;
        int skipped = 0;
        for (Map<String, Object> item : providers) {
            String name = (String) item.get("name");
            if (name == null || name.isBlank() || store.values().stream().anyMatch(p -> p.getName().equals(name))) {
                skipped++;
                continue;
            }
            ProviderConfig config = new ProviderConfig();
            config.setName(name);
            config.setApiUrl((String) item.get("apiUrl"));
            config.setApiKey((String) item.get("apiKey"));
            createProvider(config);
            imported++;
        }
        return Map.of("imported", imported, "skipped", skipped, "names", List.of());
    }
}
