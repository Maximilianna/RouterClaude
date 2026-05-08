package com.routerclaude.model.cli;

import java.util.List;

public class ClaudeCliMetaEntry {
    private String id;
    private String name;
    private List<String> tags;

    public ClaudeCliMetaEntry() {}

    public ClaudeCliMetaEntry(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
