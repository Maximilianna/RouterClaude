package com.routerclaude.model.cli;

import java.util.ArrayList;
import java.util.List;

public class ClaudeCliMeta {
    private String appliedId;
    private List<ClaudeCliMetaEntry> entries = new ArrayList<>();

    public ClaudeCliMeta() {}

    public String getAppliedId() { return appliedId; }
    public void setAppliedId(String appliedId) { this.appliedId = appliedId; }
    public List<ClaudeCliMetaEntry> getEntries() { return entries; }
    public void setEntries(List<ClaudeCliMetaEntry> entries) { this.entries = entries; }
}
