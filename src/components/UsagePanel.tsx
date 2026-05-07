import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useUsageSummary, useUsageDetails } from "../hooks/useProviders";

type Period = "today" | "week" | "month";

export default function UsagePanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("today");
  const { data: summary, isFetching: fetchingSummary } = useUsageSummary(period);
  const { data: details = [], isFetching: fetchingDetails } = useUsageDetails(50);

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["usage"] });
  }

  const providerEntries = Object.entries(summary?.byProvider ?? {}).sort((a, b) => b[1] - a[1]);
  const modelEntries = Object.entries(summary?.byModel ?? {}).sort((a, b) => b[1] - a[1]);
  const maxProvider = providerEntries[0]?.[1] ?? 1;
  const maxModel = modelEntries[0]?.[1] ?? 1;

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              period === p
                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {t(`usage.${p}`)}
          </button>
        ))}
        <button
          onClick={handleRefresh}
          disabled={fetchingSummary || fetchingDetails}
          className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title={t("common.refresh")}
        >
          <svg
            className={`h-4 w-4 ${fetchingSummary || fetchingDetails ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-gray-100 rounded-2xl p-5 bg-white/80 text-center">
          <p className="text-3xl font-bold text-gray-900 font-mono">
            {(summary?.totalTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">{t("usage.total_tokens")}</p>
        </div>
        <div className="border border-gray-100 rounded-2xl p-5 bg-white/80 text-center">
          <p className="text-3xl font-bold text-blue-600 font-mono">
            {(summary?.totalPromptTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">{t("usage.prompt_tokens")}</p>
        </div>
        <div className="border border-gray-100 rounded-2xl p-5 bg-white/80 text-center">
          <p className="text-3xl font-bold text-indigo-600 font-mono">
            {(summary?.totalCompletionTokens ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-1">{t("usage.completion_tokens")}</p>
        </div>
      </div>

      {providerEntries.length === 0 && modelEntries.length === 0 && details.length === 0 && (
        <div className="border border-gray-100 rounded-2xl p-8 bg-white/80 text-center">
          <p className="text-sm text-gray-400">{t("usage.no_data_hint")}</p>
        </div>
      )}

      {providerEntries.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-5 bg-white/80">
          <h3 className="font-semibold text-gray-900 mb-4">{t("usage.by_provider")}</h3>
          <div className="space-y-3">
            {providerEntries.map(([name, tokens]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-28 truncate">{name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                    style={{ width: `${(tokens / maxProvider) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-20 text-right">
                  {tokens.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modelEntries.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-5 bg-white/80">
          <h3 className="font-semibold text-gray-900 mb-4">{t("usage.by_model")}</h3>
          <div className="space-y-3">
            {modelEntries.slice(0, 10).map(([name, tokens]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-40 truncate font-mono">{name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    style={{ width: `${(tokens / maxModel) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500 w-20 text-right">
                  {tokens.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {details.length > 0 && (
        <div className="border border-gray-100 rounded-2xl bg-white/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t("usage.recent_details")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">{t("usage.time")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("usage.provider")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("usage.model")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.prompt")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.completion")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("usage.total")}</th>
                </tr>
              </thead>
              <tbody>
                {details.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {formatTime(r.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{r.providerName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.model}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">{r.promptTokens}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">{r.completionTokens}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">
                      {r.totalTokens}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
