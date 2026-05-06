package com.routerclaude.model;

import java.util.List;

public class ProviderConfig {
    private String name;
    private String apiUrl;
    private String apiKey;
    private List<Model> models;

    public ProviderConfig() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public List<Model> getModels() { return models; }
    public void setModels(List<Model> models) { this.models = models; }
}
