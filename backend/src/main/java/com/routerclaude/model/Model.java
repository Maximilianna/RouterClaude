package com.routerclaude.model;

public class Model {
    private String name;
    private boolean supports1m;

    public Model() {}

    public Model(String name, boolean supports1m) {
        this.name = name;
        this.supports1m = supports1m;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isSupports1m() { return supports1m; }
    public void setSupports1m(boolean supports1m) { this.supports1m = supports1m; }
}
