import { useState, useCallback } from "react";

export interface ShortcutConfig {
  switchTab1: string;
  switchTab2: string;
  add: string;
  openSettings: string;
}

const DEFAULTS: ShortcutConfig = {
  switchTab1: "1",
  switchTab2: "2",
  add: "n",
  openSettings: ",",
};

const STORAGE_KEY = "shortcutConfig";

function loadConfig(): ShortcutConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

export function useShortcutConfig() {
  const [config, setConfigState] = useState<ShortcutConfig>(loadConfig);

  const setConfig = useCallback((updater: (prev: ShortcutConfig) => ShortcutConfig) => {
    setConfigState((prev) => {
      const next = updater(prev);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState({ ...DEFAULTS });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
  }, []);

  return { config, setConfig, resetConfig, defaults: DEFAULTS };
}
