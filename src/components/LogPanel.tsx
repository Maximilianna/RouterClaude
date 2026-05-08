import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProxyStatus, useProxyLogs } from "../hooks/useProviders";
import { useWebSocket } from "../hooks/useWebSocket";
import { useVirtualScroll } from "../hooks/useVirtualScroll";

type StatusFilter = "all" | "errors" | "success";

interface ProxyStatus {
  running: boolean;
  port: number;
  totalRequests: number;
  errorRate: number;
  startupError?: string;
}

interface ProxyLogEntry {
  timestamp: number;
  model: string;
  providerName: string;
  statusCode: number;
  latencyMs: number;
  isError: boolean;
}

const ROW_HEIGHT = 40;

export default function LogPanel() {
  const { t } = useTranslation();
  const { data: initialStatus } = useProxyStatus();
  const { data: initialLogs = [] } = useProxyLogs(100);
  const { subscribe } = useWebSocket();

  const [status, setStatus] = useState<ProxyStatus | null>(initialStatus ?? null);
  const [logs, setLogs] = useState<ProxyLogEntry[]>(initialLogs);

  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (initialLogs.length > 0 && logs.length === 0) setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    const unsubLog = subscribe("proxy_log", (data) => {
      const entry = data as ProxyLogEntry;
      setLogs((prev) => [entry, ...prev].slice(0, 500));
    });
    const unsubStatus = subscribe("proxy_status", (data) => {
      setStatus(data as ProxyStatus);
    });
    return () => {
      unsubLog();
      unsubStatus();
    };
  }, [subscribe]);

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

  const { containerRef, startIndex, endIndex, totalHeight, offsetY } = useVirtualScroll({
    itemCount: filteredLogs.length,
    itemHeight: ROW_HEIGHT,
    overscan: 8,
  });

  const visibleLogs = filteredLogs.slice(startIndex, endIndex + 1);
  const bottomPad = totalHeight - offsetY - visibleLogs.length * ROW_HEIGHT;

  function formatTime(ts: number) {
    const d = new Date(ts);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString();
    return `${date} ${time}`;
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 bg-white/80 dark:bg-gray-800/80">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`w-3 h-3 rounded-full ${
              status?.running ? "bg-green-500 shadow-sm shadow-green-200 dark:shadow-green-900/50" : "bg-red-400"
            }`}
          />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {status?.running ? t("proxy.running") : t("proxy.stopped")}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">:{status?.port ?? 8901}</span>
        </div>
        {status?.startupError && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs border border-red-100 dark:border-red-800">
            <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{status.startupError}</span>
          </div>
        )}
        <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
          <span>
            {t("proxy.total_requests")}: <span className="font-mono text-gray-700 dark:text-gray-300">{status?.totalRequests ?? 0}</span>
          </span>
          <span>
            {t("proxy.error_rate")}: <span className="font-mono text-gray-700 dark:text-gray-300">{((status?.errorRate ?? 0) * 100).toFixed(1)}%</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 outline-none"
            placeholder={t("proxy.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-white/60 dark:bg-gray-800/60 rounded-xl p-0.5 border border-gray-100 dark:border-gray-700">
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
                    : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {t(`proxy.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Table header (fixed outside scroll area) */}
      <div className="border border-gray-100 dark:border-gray-700 rounded-t-2xl bg-white/80 dark:bg-gray-800/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs">
              <th className="text-left px-4 py-3 font-medium w-[180px]">{t("proxy.time")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("proxy.model")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("proxy.provider")}</th>
              <th className="text-left px-4 py-3 font-medium w-[80px]">{t("proxy.status")}</th>
              <th className="text-right px-4 py-3 font-medium w-[90px]">{t("proxy.latency")}</th>
            </tr>
          </thead>
        </table>

        {/* Virtual scroll body */}
        <div
          ref={containerRef}
          className="overflow-y-auto"
          style={{ height: "calc(100vh - 420px)", minHeight: 200 }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
              {logs.length === 0
                ? status?.running
                  ? t("proxy.no_logs_hint")
                  : t("proxy.no_logs")
                : t("proxy.no_logs")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {/* Top spacer */}
                {offsetY > 0 && (
                  <tr><td colSpan={5} style={{ height: offsetY, padding: 0, border: "none" }} /></tr>
                )}
                {visibleLogs.map((log, vi) => {
                  const realIndex = startIndex + vi;
                  return (
                    <tr
                      key={`${log.timestamp}-${realIndex}`}
                      className={`border-t border-gray-50 dark:border-gray-700/50 ${
                        log.isError
                          ? "bg-red-50/50 dark:bg-red-900/10"
                          : realIndex % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "bg-gray-50/50 dark:bg-gray-800/50"
                      }`}
                      style={{ height: ROW_HEIGHT }}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400 w-[180px]">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs dark:text-gray-300">{log.model}</td>
                      <td className="px-4 py-2.5 text-xs dark:text-gray-300">{log.providerName}</td>
                      <td className="px-4 py-2.5 w-[80px]">
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded ${
                            log.isError
                              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-500 dark:text-gray-400 w-[90px]">
                        {log.latencyMs}ms
                      </td>
                    </tr>
                  );
                })}
                {/* Bottom spacer */}
                {bottomPad > 0 && (
                  <tr><td colSpan={5} style={{ height: bottomPad, padding: 0, border: "none" }} /></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
