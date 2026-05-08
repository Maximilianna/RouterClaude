package com.routerclaude.service;

import com.routerclaude.config.ClaudeCliConfigIO;
import com.routerclaude.config.ProviderConfigIO;
import com.routerclaude.model.Provider;
import com.routerclaude.model.cli.ClaudeCliProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class HealthCheckScheduler {

    private static final Logger log = LoggerFactory.getLogger(HealthCheckScheduler.class);

    private final LoadBalancerService loadBalancerService;
    private final ProviderConfigIO providerConfigIO = new ProviderConfigIO();
    private final ClaudeCliConfigIO cliConfigIO = new ClaudeCliConfigIO();

    public HealthCheckScheduler(LoadBalancerService loadBalancerService) {
        this.loadBalancerService = loadBalancerService;
    }

    @Scheduled(fixedDelayString = "${lb.healthCheckIntervalMs:30000}")
    public void runHealthChecks() {
        if (!loadBalancerService.isLbEnabled()) return;

        List<Provider> allProviders = new ArrayList<>();
        try {
            allProviders.addAll(providerConfigIO.listAll());
        } catch (Exception e) {
            log.warn("Failed to list CCD providers for health check: {}", e.getMessage());
        }
        try {
            for (ClaudeCliProvider cp : cliConfigIO.listAll()) {
                Provider p = new Provider();
                p.setId(cp.getId());
                p.setName(cp.getName());
                p.setApiUrl(cp.getBaseUrl());
                p.setApiKey(cp.getAuthToken());
                allProviders.add(p);
            }
        } catch (Exception e) {
            log.warn("Failed to list CLI providers for health check: {}", e.getMessage());
        }

        for (Provider p : allProviders) {
            try {
                loadBalancerService.checkHealth(p);
            } catch (Exception e) {
                log.warn("Health check error for {}: {}", p.getName(), e.getMessage());
            }
        }
    }
}
