import { useTranslation } from "react-i18next";
import { useProxyStatus, useProxyLogs } from "../hooks/useProviders";

export default function LogPanel() {
  const { t } = useTranslation();
  const { data: status } = useProxyStatus();
  const { data: logs = [] } = useProxyLogs(100);

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString();
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
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                    {status?.running ? t("proxy.no_logs_hint") : t("proxy.no_logs")}
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
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
