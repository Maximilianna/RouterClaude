import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useShortcutConfig, type ShortcutConfig } from "../hooks/useShortcutConfig";

type ShortcutKey = keyof ShortcutConfig;

const SHORTCUT_KEYS: ShortcutKey[] = ["switchTab1", "switchTab2", "add", "openSettings"];

function formatKey(key: string): string {
  const map: Record<string, string> = {
    ",": ",",
    " ": "Space",
  };
  return map[key] ?? key.toUpperCase();
}

export default function ShortcutsPanel() {
  const { t } = useTranslation();
  const { config, setConfig, resetConfig } = useShortcutConfig();
  const [editing, setEditing] = useState<ShortcutKey | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      // Don't allow Escape or modifier-only keys as bindings
      if (key === "Escape" || key === "Control" || key === "Meta" || key === "Shift" || key === "Alt") {
        setEditing(null);
        return;
      }

      setConfig((prev) => ({ ...prev, [editing]: key }));
      setEditing(null);
    },
    [editing, setConfig],
  );

  useEffect(() => {
    if (!editing) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editing, handleKeyDown]);

  const actionLabels: Record<ShortcutKey, string> = {
    switchTab1: t("shortcuts.switch_tab1"),
    switchTab2: t("shortcuts.switch_tab2"),
    add: t("shortcuts.add"),
    openSettings: t("shortcuts.open_settings"),
  };

  return (
    <div className="space-y-6">
      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl bg-white/80 dark:bg-gray-800/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t("shortcuts.title")}</h3>
            <button
              onClick={resetConfig}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("shortcuts.reset")}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t("shortcuts.modifier_hint")}</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs">
              <th className="text-left px-5 py-3 font-medium">{t("shortcuts.action")}</th>
              <th className="text-right px-5 py-3 font-medium">{t("shortcuts.key")}</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUT_KEYS.map((key) => (
              <tr
                key={key}
                className="border-t border-gray-50 dark:border-gray-700/50"
              >
                <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{actionLabels[key]}</td>
                <td className="px-5 py-3 text-right">
                  {editing === key ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 animate-pulse">
                      {t("shortcuts.press_key")}
                    </span>
                  ) : (
                    <button
                      onClick={() => setEditing(key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">Ctrl+</span>
                      {formatKey(config[key])}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Escape — not customizable */}
            <tr className="border-t border-gray-50 dark:border-gray-700/50">
              <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{t("shortcuts.escape")}</td>
              <td className="px-5 py-3 text-right">
                <span className="inline-flex items-center px-3 py-1.5 text-xs font-mono font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500 rounded-lg cursor-not-allowed">
                  Esc
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
