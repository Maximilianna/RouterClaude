package com.routerclaude.model;

public record UsageRecord(
        long timestamp,
        String providerName,
        String model,
        int promptTokens,
        int completionTokens,
        int totalTokens
) {}
