package com.routerclaude.model;

import java.util.List;

public class ProviderConfig {
    private String name;
    private String apiUrl;
    private String apiKey;
    private List<Model> models;
    private String apiMode;
    private List<String> tags;
    private String proxyToken;

    public ProviderConfig() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public List<Model> getModels() { return models; }
    public void setModels(List<Model> models) { this.models = models; }
    public String getApiMode() { return apiMode; }
    public void setApiMode(String apiMode) { this.apiMode = apiMode; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getProxyToken() { return proxyToken; }
    public void setProxyToken(String proxyToken) { this.proxyToken = proxyToken; }
}
