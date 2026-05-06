package com.routerclaude.service;

import com.routerclaude.config.MetaConfig;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;

import java.io.IOException;
import java.util.List;
import java.util.Objects;

public class ProviderService implements ProviderServiceInterface {

    private final ProviderConfigIO providerConfigIO;
    private final MetaConfig metaConfig;

    public ProviderService() {
        this.providerConfigIO = new ProviderConfigIO();
        this.metaConfig = new MetaConfig();
    }

    public List<Provider> listProviders() throws IOException {
        return providerConfigIO.listAll();
    }

    public Provider getProvider(String id) throws IOException {
        return providerConfigIO.getById(id);
    }

    public Provider createProvider(ProviderConfig config) throws IOException {
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        List<Provider> existing = providerConfigIO.listAll();
        boolean nameTaken = existing.stream()
                .anyMatch(p -> p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("供应商名称已存在");
        }

        return providerConfigIO.create(config);
    }

    public void updateProvider(String id, ProviderConfig config) throws IOException {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(config, "config must not be null");
        validateConfig(config);

        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("供应商不存在");
        }

        List<Provider> all = providerConfigIO.listAll();
        boolean nameTaken = all.stream()
                .anyMatch(p -> !p.getId().equals(id) && p.getName().equals(config.getName()));
        if (nameTaken) {
            throw new ServiceException("供应商名称已存在");
        }

        providerConfigIO.update(id, config);
    }

    public void deleteProvider(String id) throws IOException {
        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("供应商不存在");
        }
        providerConfigIO.delete(id);
    }

    public void toggleProvider(String id, boolean enabled) throws IOException {
        Provider existing = providerConfigIO.getById(id);
        if (existing == null) {
            throw new ServiceException("供应商不存在");
        }

        if (enabled) {
            metaConfig.setAppliedId(id);
        } else {
            metaConfig.setAppliedId(null);
        }
    }

    public Provider getActiveProvider() throws IOException {
        String appliedId = metaConfig.getAppliedId();
        if (appliedId == null) return null;
        return providerConfigIO.getById(appliedId);
    }

    private void validateConfig(ProviderConfig config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new ServiceException("供应商名称不能为空");
        }
        if (config.getApiUrl() == null || config.getApiUrl().isBlank()) {
            throw new ServiceException("API 地址不能为空");
        }
        if (!config.getApiUrl().matches("^https?://.+")) {
            throw new ServiceException("API 地址格式无效");
        }
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new ServiceException("API Key 不能为空");
        }
        if (config.getModels() == null || config.getModels().isEmpty()) {
            throw new ServiceException("模型列表不能为空");
        }
    }
}
