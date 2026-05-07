package com.routerclaude.controller;

import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import com.routerclaude.service.ProviderService;
import com.routerclaude.service.ProviderServiceInterface;
import com.routerclaude.service.ServiceException;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

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
}
