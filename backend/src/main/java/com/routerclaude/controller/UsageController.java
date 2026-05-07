package com.routerclaude.controller;

import com.routerclaude.model.UsageRecord;
import com.routerclaude.service.UsageService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usage")
public class UsageController {

    private final UsageService usageService;

    public UsageController(UsageService usageService) {
        this.usageService = usageService;
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary(@RequestParam(defaultValue = "today") String period) {
        return usageService.getSummary(period);
    }

    @GetMapping("/details")
    public List<UsageRecord> getDetails(@RequestParam(defaultValue = "50") int limit) {
        return usageService.getDetails(limit);
    }
}
