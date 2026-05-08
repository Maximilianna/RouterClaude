package com.routerclaude.model;

import java.util.List;

public class Provider {
    private String id;
    private String name;
    private String apiUrl;
    private String apiKey;
    private List<Model> models;
    private boolean enabled;
    private String apiMode;
    private List<String> tags;
    private String proxyToken;

    public Provider() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public List<Model> getModels() { return models; }
    public void setModels(List<Model> models) { this.models = models; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getApiMode() { return apiMode; }
    public void setApiMode(String apiMode) { this.apiMode = apiMode; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getProxyToken() { return proxyToken; }
    public void setProxyToken(String proxyToken) { this.proxyToken = proxyToken; }
}
