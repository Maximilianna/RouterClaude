package com.routerclaude.service;

import com.routerclaude.model.cli.ClaudeCliConfig;
import com.routerclaude.model.cli.ClaudeCliProvider;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface ClaudeCliServiceInterface {
    List<ClaudeCliProvider> listProviders() throws IOException;
    ClaudeCliProvider getProvider(String id) throws IOException;
    ClaudeCliProvider createProvider(ClaudeCliConfig config) throws IOException;
    void updateProvider(String id, ClaudeCliConfig config) throws IOException;
    void deleteProvider(String id) throws IOException;
    void toggleProvider(String id, boolean enabled) throws IOException;
    ClaudeCliProvider getActiveProvider() throws IOException;
    ProviderService.TestResult testConnection(String id) throws IOException;
    void reorderProviders(List<String> ids) throws IOException;
    List<Map<String, Object>> exportProviders() throws IOException;
    Map<String, Object> importProviders(List<Map<String, Object>> providers) throws IOException;
}
