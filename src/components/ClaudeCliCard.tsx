import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ClaudeCliProvider } from "../types/claudeCli";
import type { TestResult } from "../hooks/useClaudeCli";
import { getTagColor } from "../utils/tagColors";

interface Props {
  provider: ClaudeCliProvider;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<TestResult>;
  toggling?: boolean;
}

export default function ClaudeCliCard({
  provider,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  toggling,
}: Props) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.9 : undefined,
    willChange: isDragging ? "transform" : undefined,
  };

  async function handleTest() {
    setTesting(true);
    try {
      await onTest();
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
          {provider.apiMode && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
              {provider.apiMode}
            </span>
          )}
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
      <p className="text-xs text-gray-400 truncate mb-3 font-mono">{provider.baseUrl}</p>
      {provider.proxyToken && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-600 border border-green-100 font-mono">
            Proxy: {provider.proxyToken}
          </span>
        </div>
      )}
      {provider.tags && provider.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {provider.tags.map((tag) => {
            const c = getTagColor(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center px-2.5 py-0.5 ${c.bg} ${c.text} text-[11px] rounded-full border ${c.border}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}
      {(provider.defaultModel || provider.defaultSonnetModel || provider.defaultOpusModel || provider.defaultHaikuModel) && (
        <div className="flex flex-wrap gap-1.5">
          {provider.defaultModel && (
            <span className="inline-flex items-center bg-gray-50 text-xs px-2.5 py-1 rounded-lg text-gray-600 border border-gray-100">
              {provider.defaultModel}
              {provider.defaultModel1m && (
                <span className="ml-1.5 text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                  1M
                </span>
              )}
            </span>
          )}
          {provider.defaultSonnetModel && (
            <span className="inline-flex items-center bg-gray-50 text-xs px-2.5 py-1 rounded-lg text-gray-600 border border-gray-100">
              Sonnet: {provider.defaultSonnetModel}
              {provider.defaultSonnetModel1m && (
                <span className="ml-1.5 text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                  1M
                </span>
              )}
            </span>
          )}
          {provider.defaultOpusModel && (
            <span className="inline-flex items-center bg-gray-50 text-xs px-2.5 py-1 rounded-lg text-gray-600 border border-gray-100">
              Opus: {provider.defaultOpusModel}
              {provider.defaultOpusModel1m && (
                <span className="ml-1.5 text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                  1M
                </span>
              )}
            </span>
          )}
          {provider.defaultHaikuModel && (
            <span className="inline-flex items-center bg-gray-50 text-xs px-2.5 py-1 rounded-lg text-gray-600 border border-gray-100">
              Haiku: {provider.defaultHaikuModel}
              {provider.defaultHaikuModel1m && (
                <span className="ml-1.5 text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                  1M
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
