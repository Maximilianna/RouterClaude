package com.routerclaude.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * Resolves config directory paths.
 *
 * Root:        ~/.routerclaude/              (app data: logs, usage)
 * CCD config:  ~/.routerclaude/ccd/          (CCD provider configs)
 * CCD external: %LOCALAPPDATA%/Claude-3p/configLibrary  (synced on write)
 *
 * Override with system properties:
 *   -Drouterclaude.config.dir=/custom/path  (root)
 *   -Dccd.config.dir=/custom/path           (CCD external)
 */
public class CcdConfigDir {

    private static final String ROUTERCLAUDE_PROPERTY_KEY = "routerclaude.config.dir";
    private static final String CCD_PROPERTY_KEY = "ccd.config.dir";

    /**
     * Returns the app root directory (~/.routerclaude/).
     * Used for data files (logs, usage).
     */
    public static Path getPath() {
        String override = System.getProperty(ROUTERCLAUDE_PROPERTY_KEY);
        if (override != null && !override.isEmpty()) {
            return Paths.get(override);
        }
        String home = System.getProperty("user.home");
        return Paths.get(home, ".routerclaude");
    }

    /**
     * Returns the CCD config directory (~/.routerclaude/ccd/).
     * Used for CCD provider configs and meta.
     * Migrates files from the old location (root) on first access.
     */
    public static Path getCcdConfigPath() {
        Path ccdDir = getPath().resolve("ccd");
        // Auto-migrate from old layout (files in root) to new layout (files in ccd/)
        migrateIfNeeded(ccdDir);
        return ccdDir;
    }

    /**
     * Returns the Claude CLI config directory (~/.routerclaude/claude-cli/).
     * Used for Claude Code CLI provider configs.
     */
    public static Path getClaudeCliConfigPath() {
        return getPath().resolve("claude-cli");
    }

    /**
     * Returns the CCD external config directory (%LOCALAPPDATA%/Claude-3p/configLibrary).
     * Writes are synced here.
     */
    public static Path getCcdPath() {
        String override = System.getProperty(CCD_PROPERTY_KEY);
        if (override != null && !override.isEmpty()) {
            return Paths.get(override);
        }
        String home = System.getProperty("user.home");
        return Paths.get(home, "AppData", "Local", "Claude-3p", "configLibrary");
    }

    /**
     * Migrates CCD config files from root (~/.routerclaude/) to ccd/ subdirectory.
     * Only migrates _meta.json and {uuid}.json files, not the data/ directory.
     */
    private static void migrateIfNeeded(Path ccdDir) {
        if (Files.isDirectory(ccdDir)) {
            return; // Already migrated
        }
        Path root = getPath();
        if (!Files.isDirectory(root)) {
            return; // Nothing to migrate
        }
        try {
            Files.createDirectories(ccdDir);
            try (var files = Files.list(root)) {
                for (Path file : (Iterable<Path>) files::iterator) {
                    String name = file.getFileName().toString();
                    // Only migrate CCD config files, skip directories (data/)
                    if (Files.isRegularFile(file) && isCcdConfigFile(name)) {
                        Files.move(file, ccdDir.resolve(name), StandardCopyOption.REPLACE_EXISTING);
                    }
                }
            }
        } catch (IOException e) {
            // Migration is best-effort
        }
    }

    private static boolean isCcdConfigFile(String name) {
        if (!name.endsWith(".json")) return false;
        if (name.equals("_meta.json")) return true;
        // {uuid}.json = 36-char UUID + ".json" = 41 chars
        return name.length() == 41;
    }
}
