package com.routerclaude.model.ccd;

import java.util.ArrayList;
import java.util.List;

public class CcdMeta {
    private String appliedId;
    private List<CcdMetaEntry> entries = new ArrayList<>();

    public CcdMeta() {}

    public String getAppliedId() { return appliedId; }
    public void setAppliedId(String appliedId) { this.appliedId = appliedId; }
    public List<CcdMetaEntry> getEntries() { return entries; }
    public void setEntries(List<CcdMetaEntry> entries) { this.entries = entries; }
}
