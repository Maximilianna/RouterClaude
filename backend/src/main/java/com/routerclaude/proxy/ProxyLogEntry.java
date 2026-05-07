package com.routerclaude.proxy;

public record ProxyLogEntry(
        long timestamp,
        String model,
        String providerName,
        int statusCode,
        long latencyMs,
        boolean isError
) {}
