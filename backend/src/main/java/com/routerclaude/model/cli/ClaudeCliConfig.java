package com.routerclaude.model.cli;

import java.util.List;

public class ClaudeCliConfig {
    private String name;
    private String baseUrl;
    private String authToken;
    private String apiMode;
    private String defaultModel;
    private String defaultSonnetModel;
    private String defaultOpusModel;
    private String defaultHaikuModel;
    private boolean defaultModel1m;
    private boolean defaultSonnetModel1m;
    private boolean defaultOpusModel1m;
    private boolean defaultHaikuModel1m;
    private List<String> tags;

    public ClaudeCliConfig() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getAuthToken() { return authToken; }
    public void setAuthToken(String authToken) { this.authToken = authToken; }
    public String getApiMode() { return apiMode; }
    public void setApiMode(String apiMode) { this.apiMode = apiMode; }
    public String getDefaultModel() { return defaultModel; }
    public void setDefaultModel(String defaultModel) { this.defaultModel = defaultModel; }
    public String getDefaultSonnetModel() { return defaultSonnetModel; }
    public void setDefaultSonnetModel(String defaultSonnetModel) { this.defaultSonnetModel = defaultSonnetModel; }
    public String getDefaultOpusModel() { return defaultOpusModel; }
    public void setDefaultOpusModel(String defaultOpusModel) { this.defaultOpusModel = defaultOpusModel; }
    public String getDefaultHaikuModel() { return defaultHaikuModel; }
    public void setDefaultHaikuModel(String defaultHaikuModel) { this.defaultHaikuModel = defaultHaikuModel; }
    public boolean isDefaultModel1m() { return defaultModel1m; }
    public void setDefaultModel1m(boolean defaultModel1m) { this.defaultModel1m = defaultModel1m; }
    public boolean isDefaultSonnetModel1m() { return defaultSonnetModel1m; }
    public void setDefaultSonnetModel1m(boolean defaultSonnetModel1m) { this.defaultSonnetModel1m = defaultSonnetModel1m; }
    public boolean isDefaultOpusModel1m() { return defaultOpusModel1m; }
    public void setDefaultOpusModel1m(boolean defaultOpusModel1m) { this.defaultOpusModel1m = defaultOpusModel1m; }
    public boolean isDefaultHaikuModel1m() { return defaultHaikuModel1m; }
    public void setDefaultHaikuModel1m(boolean defaultHaikuModel1m) { this.defaultHaikuModel1m = defaultHaikuModel1m; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
