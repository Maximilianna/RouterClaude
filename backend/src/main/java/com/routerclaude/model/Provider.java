package com.routerclaude.model;

import java.util.List;

public class Provider {
    private String id;
    private String name;
    private String apiUrl;
    private String apiKey;
    private List<Model> models;
    private boolean enabled;

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
}
