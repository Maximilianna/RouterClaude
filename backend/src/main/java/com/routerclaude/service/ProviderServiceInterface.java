package com.routerclaude.service;

import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;

import java.io.IOException;
import java.util.List;

public interface ProviderServiceInterface {
    List<Provider> listProviders() throws IOException;
    Provider getProvider(String id) throws IOException;
    Provider createProvider(ProviderConfig config) throws IOException;
    void updateProvider(String id, ProviderConfig config) throws IOException;
    void deleteProvider(String id) throws IOException;
    void toggleProvider(String id, boolean enabled) throws IOException;
    Provider getActiveProvider() throws IOException;
}
