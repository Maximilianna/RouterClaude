import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import type { Theme } from "../hooks/useTheme";
import LogPanel from "./LogPanel";
import UsagePanel from "./UsagePanel";
import AboutPanel from "./AboutPanel";
import ShortcutsPanel from "./ShortcutsPanel";
import LbPanel from "./LbPanel";

export type SubPage = null | "logs" | "usage" | "about" | "shortcuts" | "lb";

interface Props {
  onBack: () => void;
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
  subPage: SubPage;
  setSubPage: (subPage: SubPage) => void;
  onAboutDialogChange?: (open: boolean) => void;
}

export default function SettingsPanel({ onBack, onToast, subPage, setSubPage, onAboutDialogChange }: Props) {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { theme, setTheme } = useTheme();

  const [retryMaxAttempts, setRetryMaxAttempts] = useState(3);
  const [retryDelayMs, setRetryDelayMs] = useState(1000);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheTtlMs, setCacheTtlMs] = useState(300000);
  const [cacheMaxEntries, setCacheMaxEntries] = useState(200);

  useEffect(() => {
    if (settings) {
      setRetryMaxAttempts(settings.retryMaxAttempts ?? 3);
      setRetryDelayMs(settings.retryDelayMs ?? 1000);
      setCacheEnabled(settings.cacheEnabled ?? true);
      setCacheTtlMs(settings.cacheTtlMs ?? 300000);
      setCacheMaxEntries(settings.cacheMaxEntries ?? 200);
    }
  }, [settings]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        retryMaxAttempts: Number(retryMaxAttempts),
        retryDelayMs: Number(retryDelayMs),
        cacheEnabled,
        cacheTtlMs: Number(cacheTtlMs),
        cacheMaxEntries: Number(cacheMaxEntries),
      });
      onToast({ type: "success", message: t("settings.saved") });
    } catch {
      onToast({ type: "error", message: t("settings.save_failed") });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (subPage === "logs") {
    return (
      <div>
        <button
          onClick={() => setSubPage(null)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{t("common.back")}</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("nav.logs")}</h2>
        <LogPanel />
      </div>
    );
  }

  if (subPage === "usage") {
    return (
      <div>
        <button
          onClick={() => setSubPage(null)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{t("common.back")}</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("nav.usage")}</h2>
        <UsagePanel />
      </div>
    );
  }

  if (subPage === "about") {
    return (
      <div>
        <button
          onClick={() => setSubPage(null)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{t("common.back")}</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("nav.about")}</h2>
        <AboutPanel onDialogChange={onAboutDialogChange} />
      </div>
    );
  }

  if (subPage === "shortcuts") {
    return (
      <div>
        <button
          onClick={() => setSubPage(null)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{t("common.back")}</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("shortcuts.title")}</h2>
        <ShortcutsPanel />
      </div>
    );
  }

  if (subPage === "lb") {
    return (
      <div>
        <button
          onClick={() => setSubPage(null)}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{t("common.back")}</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6">{t("settings.lb")}</h2>
        <LbPanel onToast={onToast} />
      </div>
    );
  }

  const themeOptions: { key: Theme; label: string }[] = [
    { key: "system", label: t("settings.theme_system") },
    { key: "light", label: t("settings.theme_light") },
    { key: "dark", label: t("settings.theme_dark") },
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-5 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">{t("common.back")}</span>
      </button>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t("settings.title")}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubPage("logs")}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("nav.logs")}
          </button>
          <button
            onClick={() => setSubPage("usage")}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("nav.usage")}
          </button>
          <button
            onClick={() => setSubPage("about")}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("nav.about")}
          </button>
          <button
            onClick={() => setSubPage("shortcuts")}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("shortcuts.title")}
          </button>
          <button
            onClick={() => setSubPage("lb")}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("settings.lb")}
          </button>
        </div>
      </div>

      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-6 bg-white/80 dark:bg-gray-800/80 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t("settings.theme")}</h3>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setTheme(opt.key)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                  theme === opt.key
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/50"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t("settings.retry")}</h3>
          <div className="space-y-4 pl-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.retry_max_attempts")}</label>
              <input
                type="number"
                min={0}
                max={10}
                value={retryMaxAttempts}
                onChange={(e) => setRetryMaxAttempts(Number(e.target.value))}
                className="w-20 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all outline-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.retry_delay_ms")}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={30000}
                  step={500}
                  value={retryDelayMs}
                  onChange={(e) => setRetryDelayMs(Number(e.target.value))}
                  className="w-20 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all outline-none"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">ms</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("settings.retry_hint")}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t("settings.cache")}</h3>
          <div className="space-y-4 pl-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.cache_enabled")}</label>
              <button
                type="button"
                onClick={() => setCacheEnabled(!cacheEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  cacheEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    cacheEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.cache_ttl_ms")}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={3600000}
                  step={60000}
                  value={cacheTtlMs}
                  onChange={(e) => setCacheTtlMs(Number(e.target.value))}
                  className="w-24 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all outline-none"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">ms</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.cache_max_entries")}</label>
              <input
                type="number"
                min={10}
                max={1000}
                value={cacheMaxEntries}
                onChange={(e) => setCacheMaxEntries(Number(e.target.value))}
                className="w-20 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-right focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("settings.cache_hint")}</p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 dark:shadow-blue-900/50 transition-all duration-200 disabled:opacity-50"
          >
            {updateSettings.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
