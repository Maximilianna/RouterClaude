package com.routerclaude.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.routerclaude.config.DataStore;
import com.routerclaude.model.UsageRecord;
import com.routerclaude.websocket.EventWebSocketHandler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

@Service
public class UsageService {

    private static final Logger log = LoggerFactory.getLogger(UsageService.class);
    private static final int MAX_RECORDS = 10000;
    private final ConcurrentLinkedDeque<UsageRecord> records = new ConcurrentLinkedDeque<>();
    private final DataStore<UsageRecord> store = new DataStore<>("usage.json", new TypeReference<>() {});
    @Autowired(required = false)
    private EventWebSocketHandler wsHandler;

    @PostConstruct
    public void init() {
        List<UsageRecord> loaded = store.load();
        for (UsageRecord r : loaded) {
            records.addLast(r);
        }
        if (!loaded.isEmpty()) {
            log.info("Loaded {} persisted usage records", loaded.size());
        }
    }

    @PreDestroy
    public void shutdown() {
        flush();
    }

    public void record(UsageRecord record) {
        records.addFirst(record);
        while (records.size() > MAX_RECORDS) {
            records.removeLast();
        }
        flush();
        if (wsHandler != null) {
            wsHandler.broadcast("usage_update", getSummary("today"));
        }
    }

    public void flush() {
        try {
            store.save(List.copyOf(records));
        } catch (Exception e) {
            log.error("Failed to flush usage records", e);
        }
    }

    public Map<String, Object> getSummary(String period) {
        long cutoff = getCutoff(period);
        List<UsageRecord> filtered = records.stream()
                .filter(r -> r.timestamp() >= cutoff)
                .toList();

        long totalPrompt = filtered.stream().mapToLong(UsageRecord::promptTokens).sum();
        long totalCompletion = filtered.stream().mapToLong(UsageRecord::completionTokens).sum();
        long totalTokens = filtered.stream().mapToLong(UsageRecord::totalTokens).sum();

        Map<String, Long> byProvider = filtered.stream()
                .collect(Collectors.groupingBy(UsageRecord::providerName, Collectors.summingLong(UsageRecord::totalTokens)));

        Map<String, Long> byModel = filtered.stream()
                .collect(Collectors.groupingBy(UsageRecord::model, Collectors.summingLong(UsageRecord::totalTokens)));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalPromptTokens", totalPrompt);
        summary.put("totalCompletionTokens", totalCompletion);
        summary.put("totalTokens", totalTokens);
        summary.put("requestCount", filtered.size());
        summary.put("byProvider", byProvider);
        summary.put("byModel", byModel);
        return summary;
    }

    public List<UsageRecord> getDetails(int limit) {
        return records.stream().limit(limit).toList();
    }

    private long getCutoff(String period) {
        LocalDate now = LocalDate.now();
        LocalDate cutoffDate = switch (period == null ? "today" : period) {
            case "week" -> now.minusDays(7);
            case "month" -> now.minusDays(30);
            default -> now;
        };
        return cutoffDate.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }
}
