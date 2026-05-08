import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLbConfig, useUpdateLbConfig, useLbProviders, type LbEntry, type LbProvider } from "../hooks/useLbConfig";

interface Props {
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
}

export default function LbPanel({ onToast }: Props) {
  const { t } = useTranslation();
  const { data: config, isLoading } = useLbConfig();
  const updateConfig = useUpdateLbConfig();
  const { data: ccdProviders } = useLbProviders("ccd");
  const { data: ccProviders } = useLbProviders("cc");

  const [lbEnabled, setLbEnabled] = useState(false);
  const [lbStrategy, setLbStrategy] = useState<"round_robin" | "weighted" | "lowest_latency">("round_robin");
  const [activeTab, setActiveTab] = useState<"ccd" | "cc">("ccd");
  const [ccdEntries, setCcdEntries] = useState<LbEntry[]>([]);
  const [ccEntries, setCcEntries] = useState<LbEntry[]>([]);
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  useEffect(() => {
    if (config) {
      setLbEnabled(config.lbEnabled ?? false);
      setLbStrategy(config.lbStrategy ?? "round_robin");
      setCcdEntries(config.lbCcdEntries ?? []);
      setCcEntries(config.lbCcEntries ?? []);
    }
  }, [config]);

  const entries = activeTab === "ccd" ? ccdEntries : ccEntries;
  const setEntries = activeTab === "ccd" ? setCcdEntries : setCcEntries;
  const providers = activeTab === "ccd" ? ccdProviders : ccProviders;

  // Providers not yet in the LB group
  const availableProviders = (providers ?? []).filter(
    (p) => !entries.some((e) => e.providerId === p.id)
  );

  async function handleSave() {
    try {
      await updateConfig.mutateAsync({
        lbEnabled,
        lbStrategy,
        lbCcdEntries: ccdEntries,
        lbCcEntries: ccEntries,
      });
      onToast({ type: "success", message: t("settings.saved") });
    } catch {
      onToast({ type: "error", message: t("settings.save_failed") });
    }
  }

  function addProvider(provider: LbProvider) {
    setEntries([...entries, { providerId: provider.id, models: [], weight: 1 }]);
    setShowAddDropdown(false);
  }

  function removeProvider(providerId: string) {
    setEntries(entries.filter((e) => e.providerId !== providerId));
  }

  function toggleModel(providerId: string, model: string) {
    setEntries(
      entries.map((e) => {
        if (e.providerId !== providerId) return e;
        const models = e.models.includes(model)
          ? e.models.filter((m) => m !== model)
          : [...e.models, model];
        return { ...e, models };
      })
    );
  }

  function setWeight(providerId: string, weight: number) {
    setEntries(
      entries.map((e) => (e.providerId === providerId ? { ...e, weight } : e))
    );
  }

  function getProviderName(providerId: string): string {
    return providers?.find((p) => p.id === providerId)?.name ?? providerId;
  }

  function getProviderModels(providerId: string): string[] {
    return providers?.find((p) => p.id === providerId)?.models ?? [];
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

  return (
    <div className="space-y-6">
      {/* Enable toggle + strategy */}
      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-6 bg-white/80 dark:bg-gray-800/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("settings.lb_enabled")}</label>
          <button
            type="button"
            onClick={() => setLbEnabled(!lbEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              lbEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                lbEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {lbEnabled && (
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">{t("settings.lb_strategy")}</label>
            <select
              value={lbStrategy}
              onChange={(e) => setLbStrategy(e.target.value as typeof lbStrategy)}
              className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all outline-none"
            >
              <option value="round_robin">{t("settings.lb_strategy_round_robin")}</option>
              <option value="weighted">{t("settings.lb_strategy_weighted")}</option>
              <option value="lowest_latency">{t("settings.lb_strategy_lowest_latency")}</option>
            </select>
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">{t("settings.lb_hint")}</p>
      </div>

      {lbEnabled && (
        <>
          {/* CCD / CC tab switch */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("ccd")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "ccd"
                  ? "bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t("nav.providers")}
            </button>
            <button
              onClick={() => setActiveTab("cc")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "cc"
                  ? "bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t("nav.cli")}
            </button>
          </div>

          {/* Provider list */}
          <div className="border border-gray-100 dark:border-gray-700 rounded-2xl bg-white/80 dark:bg-gray-800/80 shadow-sm overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                {t("lb.no_entries")}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry) => {
                  const allModels = getProviderModels(entry.providerId);
                  return (
                    <div key={entry.providerId} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {getProviderName(entry.providerId)}
                          </span>
                        </div>
                        <button
                          onClick={() => removeProvider(entry.providerId)}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title={t("common.delete")}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Model multi-select */}
                      {allModels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {allModels.map((model) => (
                            <button
                              key={model}
                              onClick={() => toggleModel(entry.providerId, model)}
                              className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                                entry.models.includes(model)
                                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                              }`}
                            >
                              {model}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Weight slider */}
                      {lbStrategy === "weighted" && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-gray-500 dark:text-gray-400">{t("provider.weight")}</label>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={entry.weight}
                            onChange={(e) => setWeight(entry.providerId, Number(e.target.value))}
                            className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-4 text-right">{entry.weight}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add provider dropdown */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 relative">
              <button
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                disabled={availableProviders.length === 0}
                className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("lb.add_provider")}
              </button>
              {showAddDropdown && availableProviders.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {availableProviders.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProvider(p)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      {p.name}
                      {p.enabled && (
                        <span className="ml-2 text-xs text-green-500">({t("common.enabled")})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <div>
        <button
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 dark:shadow-blue-900/50 transition-all duration-200 disabled:opacity-50"
        >
          {updateConfig.isPending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
