package com.routerclaude.config;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Resolves the CCD config directory path.
 *
 * Default: C:\Users\{username}\AppData\Local\Claude-3p\configLibrary
 * Override with system property: -Dccd.config.dir=/custom/path
 */
public class CcdConfigDir {

    private static final String PROPERTY_KEY = "ccd.config.dir";

    public static Path getPath() {
        String override = System.getProperty(PROPERTY_KEY);
        if (override != null && !override.isEmpty()) {
            return Paths.get(override);
        }
        String home = System.getProperty("user.home");
        return Paths.get(home, "AppData", "Local", "Claude-3p", "configLibrary");
    }
}
