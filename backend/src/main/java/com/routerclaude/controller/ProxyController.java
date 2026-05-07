package com.routerclaude.controller;

import com.routerclaude.proxy.ProxyLogEntry;
import com.routerclaude.proxy.ProxyServer;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/proxy")
public class ProxyController {

    private final ProxyServer proxyServer;

    public ProxyController(ProxyServer proxyServer) {
        this.proxyServer = proxyServer;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return proxyServer.getStatus();
    }

    @GetMapping("/logs")
    public List<ProxyLogEntry> getLogs(@RequestParam(defaultValue = "100") int limit) {
        return proxyServer.getLogs(limit);
    }
}
