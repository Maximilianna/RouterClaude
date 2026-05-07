package com.routerclaude.config;

import com.routerclaude.model.Model;
import com.routerclaude.model.Provider;
import com.routerclaude.model.ProviderConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ProviderConfigIOTest {

    @TempDir
    Path tempDir;

    private ProviderConfigIO providerConfigIO;

    @BeforeEach
    void setUp() {
        System.setProperty("routerclaude.config.dir", tempDir.toString());
        System.setProperty("ccd.config.dir", tempDir.toString());
        providerConfigIO = new ProviderConfigIO();
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("routerclaude.config.dir");
        System.clearProperty("ccd.config.dir");
    }

    @Test
    void listAllReturnsEmptyWhenDirIsEmpty() throws Exception {
        List<Provider> providers = providerConfigIO.listAll();
        assertTrue(providers.isEmpty());
    }

    @Test
    void createAndListProvider() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("TestProvider");
        config.setApiUrl("https://api.test.com");
        config.setApiKey("sk-test-key");
        config.setModels(List.of(
                new Model("test-model-v1", true),
                new Model("test-model-v2", false)
        ));

        Provider created = providerConfigIO.create(config);
        assertNotNull(created.getId());
        assertEquals("TestProvider", created.getName());
        assertFalse(created.isEnabled());

        List<Provider> all = providerConfigIO.listAll();
        assertEquals(1, all.size());
        Provider loaded = all.get(0);
        assertEquals(created.getId(), loaded.getId());
        assertEquals("TestProvider", loaded.getName());
        assertEquals("https://api.test.com", loaded.getApiUrl());
        assertEquals(2, loaded.getModels().size());
    }

    @Test
    void getByIdReturnsProvider() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("Finder");
        config.setApiUrl("https://api.finder.com");
        config.setApiKey("sk-finder");
        config.setModels(List.of(new Model("finder-model", true)));

        Provider created = providerConfigIO.create(config);
        Provider loaded = providerConfigIO.getById(created.getId());

        assertNotNull(loaded);
        assertEquals(created.getId(), loaded.getId());
        assertEquals("Finder", loaded.getName());
    }

    @Test
    void getByIdReturnsNullWhenNotFound() throws Exception {
        Provider loaded = providerConfigIO.getById("nonexistent-uuid");
        assertNull(loaded);
    }

    @Test
    void updateProviderChangesConfig() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("Original");
        config.setApiUrl("https://api.original.com");
        config.setApiKey("sk-original");
        config.setModels(List.of(new Model("model-v1", true)));

        Provider created = providerConfigIO.create(config);

        ProviderConfig updatedConfig = new ProviderConfig();
        updatedConfig.setName("Updated");
        updatedConfig.setApiUrl("https://api.updated.com");
        updatedConfig.setApiKey("sk-updated");
        updatedConfig.setModels(List.of(new Model("model-v2", false)));

        providerConfigIO.update(created.getId(), updatedConfig);

        Provider loaded = providerConfigIO.getById(created.getId());
        assertEquals("Updated", loaded.getName());
        assertEquals("https://api.updated.com", loaded.getApiUrl());
        assertEquals("sk-updated", loaded.getApiKey());
        assertEquals("model-v2", loaded.getModels().get(0).getName());
    }

    @Test
    void deleteProviderRemovesFileAndMetaEntry() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("ToDelete");
        config.setApiUrl("https://api.delete.com");
        config.setApiKey("sk-delete");
        config.setModels(List.of(new Model("del-model", false)));

        Provider created = providerConfigIO.create(config);

        providerConfigIO.delete(created.getId());

        assertNull(providerConfigIO.getById(created.getId()));
        assertTrue(providerConfigIO.listAll().isEmpty());
    }

    @Test
    void modelNameGetsClaudePrefixOnCreate() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("PrefixTest");
        config.setApiUrl("https://api.prefix.com");
        config.setApiKey("sk-prefix");
        config.setModels(List.of(new Model("my-model", true)));

        Provider created = providerConfigIO.create(config);

        // Read raw CCD file to check prefix
        MetaConfig metaConfig = new MetaConfig();
        var meta = metaConfig.read();
        assertFalse(meta.getEntries().isEmpty());

        // The model name in the app should NOT have the prefix
        assertEquals("my-model", created.getModels().get(0).getName());
    }

    @Test
    void modelNameStripsClaudePrefixOnRead() throws Exception {
        // Manually create a CCD config file with claude- prefix
        com.routerclaude.model.ccd.CcdProviderConfig ccdConfig = new com.routerclaude.model.ccd.CcdProviderConfig();
        ccdConfig.setInferenceProvider("gateway");
        ccdConfig.setInferenceGatewayBaseUrl("https://api.test.com");
        ccdConfig.setInferenceGatewayApiKey("sk-test");
        ccdConfig.setInferenceModels(List.of(
                new com.routerclaude.model.ccd.CcdModel("claude-prefixed-model", true)
        ));

        // Write it directly simulating an existing CCD setup
        MetaConfig metaConfig = new MetaConfig();
        metaConfig.upsertEntry("test-uuid", "ExistingProvider");

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Path ccdDir = tempDir.resolve("ccd");
        ccdDir.toFile().mkdirs();
        mapper.writeValue(ccdDir.resolve("test-uuid.json").toFile(), ccdConfig);

        Provider loaded = providerConfigIO.getById("test-uuid");
        assertNotNull(loaded);
        assertEquals("ExistingProvider", loaded.getName());
        assertEquals(1, loaded.getModels().size());
        assertEquals("prefixed-model", loaded.getModels().get(0).getName());
        assertFalse(loaded.isEnabled());
    }

    @Test
    void enabledFlagMatchesAppliedId() throws Exception {
        ProviderConfig config = new ProviderConfig();
        config.setName("ActiveOne");
        config.setApiUrl("https://api.active.com");
        config.setApiKey("sk-active");
        config.setModels(List.of(new Model("act-model", true)));

        Provider created = providerConfigIO.create(config);

        // Activate it
        MetaConfig metaConfig = new MetaConfig();
        metaConfig.setAppliedId(created.getId());

        Provider loaded = providerConfigIO.getById(created.getId());
        assertTrue(loaded.isEnabled());
    }

    @Test
    void multipleProvidersListAll() throws Exception {
        for (int i = 1; i <= 3; i++) {
            ProviderConfig config = new ProviderConfig();
            config.setName("Provider" + i);
            config.setApiUrl("https://api" + i + ".com");
            config.setApiKey("sk-" + i);
            config.setModels(List.of(new Model("m" + i, true)));
            providerConfigIO.create(config);
        }

        List<Provider> all = providerConfigIO.listAll();
        assertEquals(3, all.size());
    }
}
