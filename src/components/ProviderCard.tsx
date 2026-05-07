import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Provider } from "../types/provider";
import type { TestResult } from "../hooks/useProviders";

interface Props {
  provider: Provider;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<TestResult>;
  toggling?: boolean;
}

export default function ProviderCard({
  provider,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  toggling,
}: Props) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.id });

  function translateMessage(msg: string): string {
    if (msg === "SUCCESS") return t("common.test_success_msg");
    if (msg.startsWith("FAILED_HTTP:")) return t("common.test_failed_http", { code: msg.slice(12) });
    if (msg === "INTERRUPTED") return t("common.test_interrupted");
    if (msg === "SERVER_UNREACHABLE") return t("common.test_server_unreachable");
    if (msg === "TIMEOUT") return t("common.test_timeout");
    if (msg.startsWith("ERROR:")) return t("common.test_error", { detail: msg.slice(6) });
    return msg;
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : undefined,
    willChange: isDragging ? "transform" : undefined,
  };

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
      setTimeout(() => setTestResult(null), 8000);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : t("common.test_failed"),
        latencyMs: -1,
      });
      setTimeout(() => setTestResult(null), 8000);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border rounded-2xl p-5 bg-white hover:bg-white hover:shadow-lg hover:shadow-gray-200/50 transition-[border-color,box-shadow,background-color] duration-200 ${
        isDragging
          ? "border-blue-400 shadow-xl shadow-blue-100/50"
          : "border-gray-100"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors touch-none"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>
          <span
            className={`w-3 h-3 rounded-full ${
              provider.enabled
                ? "bg-green-500 shadow-sm shadow-green-200"
                : "bg-gray-200"
            }`}
          />
          <h3 className="font-semibold text-gray-900">{provider.name}</h3>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50"
          >
            {testing ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("common.testing")}
              </span>
            ) : (
              t("common.test")
            )}
          </button>
          <button
            onClick={() => onToggle(!provider.enabled)}
            disabled={toggling}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
              provider.enabled
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200"
            }`}
          >
            {provider.enabled ? t("common.enabled") : t("common.enable")}
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            {t("common.edit")}
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 truncate mb-3 font-mono">{provider.apiUrl}</p>
      {testResult && (
        <div
          className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
            !testResult.success
              ? "bg-red-50 text-red-600 border border-red-100"
              : testResult.latencyMs > 2000
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-green-50 text-green-700 border border-green-100"
          }`}
        >
          {testResult.success ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <span>{translateMessage(testResult.message)}</span>
          {testResult.success && testResult.latencyMs >= 0 && (
            <span className={`ml-auto font-mono text-xs ${
              testResult.latencyMs > 2000 ? "text-red-500" : "text-green-600"
            }`}>
              {testResult.latencyMs}ms
            </span>
          )}
        </div>
      )}
      {provider.models.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {provider.models.map((m) => (
            <span
              key={m.name}
              className="inline-flex items-center bg-gray-50 text-xs px-2.5 py-1 rounded-lg text-gray-600 border border-gray-100"
            >
              {m.name}
              {m.supports1m && (
                <span className="ml-1.5 text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                  {t("provider.1m_context")}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
