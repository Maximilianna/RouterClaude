import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProxyStatus, useProxyLogs } from "../hooks/useProviders";

type StatusFilter = "all" | "errors" | "success";

export default function LogPanel() {
  const { t } = useTranslation();
  const { data: status } = useProxyStatus();
  const { data: logs = [] } = useProxyLogs(100);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (statusFilter === "errors") {
      result = result.filter((l) => l.isError);
    } else if (statusFilter === "success") {
      result = result.filter((l) => !l.isError);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.model.toLowerCase().includes(q) ||
          l.providerName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, search, statusFilter]);

  function formatTime(ts: number) {
    const d = new Date(ts);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString();
    return `${date} ${time}`;
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-100 rounded-2xl p-5 bg-white/80">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`w-3 h-3 rounded-full ${
              status?.running ? "bg-green-500 shadow-sm shadow-green-200" : "bg-red-400"
            }`}
          />
          <span className="font-semibold text-gray-900">
            {status?.running ? t("proxy.running") : t("proxy.stopped")}
          </span>
          <span className="text-xs text-gray-400 font-mono">:{status?.port ?? 8901}</span>
        </div>
        {status?.startupError && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100">
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{status.startupError}</span>
          </div>
        )}
        <div className="flex gap-6 text-sm text-gray-500">
          <span>
            {t("proxy.total_requests")}: <span className="font-mono text-gray-700">{status?.totalRequests ?? 0}</span>
          </span>
          <span>
            {t("proxy.error_rate")}: <span className="font-mono text-gray-700">{((status?.errorRate ?? 0) * 100).toFixed(1)}%</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 outline-none"
            placeholder={t("proxy.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-white/60 rounded-xl p-0.5 border border-gray-100">
          {(["all", "errors", "success"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                statusFilter === f
                  ? f === "errors"
                    ? "bg-red-500 text-white shadow-sm"
                    : f === "success"
                    ? "bg-green-500 text-white shadow-sm"
                    : "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`proxy.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-gray-100 rounded-2xl bg-white/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-4 py-3 font-medium">{t("proxy.time")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("proxy.model")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("proxy.provider")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("proxy.status")}</th>
                <th className="text-right px-4 py-3 font-medium">{t("proxy.latency")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                    {logs.length === 0
                      ? status?.running
                        ? t("proxy.no_logs_hint")
                        : t("proxy.no_logs")
                      : t("proxy.no_logs")}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-50 ${
                      log.isError ? "bg-red-50/50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{log.model}</td>
                    <td className="px-4 py-2.5 text-xs">{log.providerName}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          log.isError
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-500">
                      {log.latencyMs}ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
