package com.routerclaude.service;

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

class ProviderServiceTest {

    @TempDir
    Path tempDir;

    private ProviderService providerService;

    @BeforeEach
    void setUp() {
        System.setProperty("routerclaude.config.dir", tempDir.toString());
        System.setProperty("ccd.config.dir", tempDir.toString());
        providerService = new ProviderService();
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("routerclaude.config.dir");
        System.clearProperty("ccd.config.dir");
    }

    private ProviderConfig makeConfig(String name) {
        ProviderConfig config = new ProviderConfig();
        config.setName(name);
        config.setApiUrl("https://api.test.com");
        config.setApiKey("sk-key");
        config.setModels(List.of(new Model("model-v1", true)));
        return config;
    }

    @Test
    void listProvidersReturnsEmptyInitially() throws Exception {
        assertTrue(providerService.listProviders().isEmpty());
    }

    @Test
    void createAndListProvider() throws Exception {
        Provider created = providerService.createProvider(makeConfig("TestProvider"));
        assertNotNull(created.getId());

        List<Provider> all = providerService.listProviders();
        assertEquals(1, all.size());
        assertEquals("TestProvider", all.get(0).getName());
    }

    @Test
    void createWithDuplicateNameThrows() throws Exception {
        providerService.createProvider(makeConfig("Duplicate"));
        assertThrows(ServiceException.class, () ->
                providerService.createProvider(makeConfig("Duplicate")));
    }

    @Test
    void getProviderReturnsCorrectProvider() throws Exception {
        Provider created = providerService.createProvider(makeConfig("Finder"));
        Provider loaded = providerService.getProvider(created.getId());
        assertNotNull(loaded);
        assertEquals("Finder", loaded.getName());
    }

    @Test
    void getProviderReturnsNullForMissing() throws Exception {
        assertNull(providerService.getProvider("nonexistent"));
    }

    @Test
    void updateProvider() throws Exception {
        Provider created = providerService.createProvider(makeConfig("Original"));

        ProviderConfig updatedConfig = makeConfig("Updated");
        providerService.updateProvider(created.getId(), updatedConfig);

        Provider loaded = providerService.getProvider(created.getId());
        assertEquals("Updated", loaded.getName());
    }

    @Test
    void updateNonexistentProviderThrows() throws Exception {
        assertThrows(ServiceException.class, () ->
                providerService.updateProvider("bad-id", makeConfig("X")));
    }

    @Test
    void updateToDuplicateNameThrows() throws Exception {
        providerService.createProvider(makeConfig("First"));
        Provider second = providerService.createProvider(makeConfig("Second"));

        ProviderConfig updatedToFirst = makeConfig("First");
        assertThrows(ServiceException.class, () ->
                providerService.updateProvider(second.getId(), updatedToFirst));
    }

    @Test
    void deleteProvider() throws Exception {
        Provider created = providerService.createProvider(makeConfig("ToDelete"));
        providerService.deleteProvider(created.getId());
        assertNull(providerService.getProvider(created.getId()));
        assertTrue(providerService.listProviders().isEmpty());
    }

    @Test
    void deleteNonexistentProviderThrows() throws Exception {
        assertThrows(ServiceException.class, () ->
                providerService.deleteProvider("bad-id"));
    }

    @Test
    void toggleProviderEnable() throws Exception {
        Provider created = providerService.createProvider(makeConfig("ToggleMe"));
        providerService.toggleProvider(created.getId(), true);

        Provider active = providerService.getActiveProvider();
        assertNotNull(active);
        assertEquals(created.getId(), active.getId());
    }

    @Test
    void toggleProviderDisable() throws Exception {
        Provider created = providerService.createProvider(makeConfig("ToggleMe"));
        providerService.toggleProvider(created.getId(), true);
        providerService.toggleProvider(created.getId(), false);

        assertNull(providerService.getActiveProvider());
    }

    @Test
    void toggleNonexistentProviderThrows() throws Exception {
        assertThrows(ServiceException.class, () ->
                providerService.toggleProvider("bad-id", true));
    }

    @Test
    void getActiveProviderReturnsNullWhenNoneActive() throws Exception {
        assertNull(providerService.getActiveProvider());
    }

    @Test
    void createValidatesNameRequired() {
        ProviderConfig config = makeConfig("X");
        config.setName(null);
        assertThrows(ServiceException.class, () -> providerService.createProvider(config));
    }

    @Test
    void createValidatesUrlFormat() {
        ProviderConfig config = makeConfig("X");
        config.setApiUrl("not-a-url");
        assertThrows(ServiceException.class, () -> providerService.createProvider(config));
    }

    @Test
    void createValidatesModelsNotEmpty() {
        ProviderConfig config = makeConfig("X");
        config.setModels(List.of());
        assertThrows(ServiceException.class, () -> providerService.createProvider(config));
    }

    @Test
    void getProviderShowsEnabledStatus() throws Exception {
        Provider created = providerService.createProvider(makeConfig("StatusCheck"));
        assertFalse(providerService.getProvider(created.getId()).isEnabled());

        providerService.toggleProvider(created.getId(), true);
        assertTrue(providerService.getProvider(created.getId()).isEnabled());
    }
}
