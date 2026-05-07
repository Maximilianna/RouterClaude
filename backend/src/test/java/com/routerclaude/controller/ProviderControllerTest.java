package com.routerclaude.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.routerclaude.model.Provider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProviderControllerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private StubProviderService stubService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        stubService = new StubProviderService();
        var controller = new ProviderController(stubService);
        mockMvc = MockMvcBuilders
                .standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private String createProvider(String name) throws Exception {
        String json = """
                {"name":"%s","apiUrl":"https://api.%s.com","apiKey":"sk","models":[{"name":"m","supports1m":true}]}
                """.formatted(name, name.toLowerCase());
        var result = mockMvc.perform(post("/api/providers")
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn();
        Provider p = mapper.readValue(result.getResponse().getContentAsString(), Provider.class);
        return p.getId();
    }

    @Test
    void listProvidersReturnsEmpty() throws Exception {
        mockMvc.perform(get("/api/providers"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void createAndListProvider() throws Exception {
        mockMvc.perform(post("/api/providers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test","apiUrl":"https://api.test.com","apiKey":"sk-key","models":[{"name":"m1","supports1m":true}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Test"));

        mockMvc.perform(get("/api/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Test"));
    }

    @Test
    void createWithDuplicateNameReturns400() throws Exception {
        String body = """
                {"name":"Dup","apiUrl":"https://api.d.com","apiKey":"sk","models":[{"name":"m","supports1m":true}]}
                """;
        mockMvc.perform(post("/api/providers").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/providers").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("NAME_TAKEN"));
    }

    @Test
    void getProviderById() throws Exception {
        String id = createProvider("Finder");

        mockMvc.perform(get("/api/providers/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Finder"));
    }

    @Test
    void updateProvider() throws Exception {
        String id = createProvider("Orig");

        mockMvc.perform(put("/api/providers/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Updated","apiUrl":"https://api.u.com","apiKey":"sk2","models":[{"name":"m2","supports1m":false}]}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/providers/" + id))
                .andExpect(jsonPath("$.name").value("Updated"));
    }

    @Test
    void updateNonexistentReturns404() throws Exception {
        mockMvc.perform(put("/api/providers/bad-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"X","apiUrl":"https://x.com","apiKey":"sk","models":[{"name":"m","supports1m":true}]}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("PROVIDER_NOT_FOUND"));
    }

    @Test
    void deleteProvider() throws Exception {
        String id = createProvider("Del");

        mockMvc.perform(delete("/api/providers/" + id))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/providers"))
                .andExpect(content().json("[]"));
    }

    @Test
    void deleteNonexistentReturns404() throws Exception {
        mockMvc.perform(delete("/api/providers/bad-id"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("PROVIDER_NOT_FOUND"));
    }

    @Test
    void toggleProviderEnable() throws Exception {
        String id = createProvider("Tog");

        mockMvc.perform(patch("/api/providers/" + id + "/toggle?enabled=true"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/providers/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void toggleProviderDisable() throws Exception {
        String id = createProvider("Tog");
        stubService.activeId = id;

        mockMvc.perform(patch("/api/providers/" + id + "/toggle?enabled=false"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/providers/active"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }

    @Test
    void getActiveProviderWhenNone() throws Exception {
        mockMvc.perform(get("/api/providers/active"))
                .andExpect(status().isOk())
                .andExpect(content().string(""));
    }
}
