import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
  useDeleteProvider,
  useToggleProvider,
  useTestConnection,
  useTestAll,
  useReorderProviders,
  useExportProviders,
  useImportProviders,
} from "./hooks/useProviders";
import ProviderCard from "./components/ProviderCard";
import ProviderForm from "./components/ProviderForm";
import SettingsPanel from "./components/SettingsPanel";
import ClaudeCliPanel from "./components/ClaudeCliPanel";
import { ToastContainer, type ToastItem } from "./components/Toast";
import type { Provider, ProviderConfig } from "./types/provider";
import { API_BASE } from "./config";
import { getTagColor } from "./utils/tagColors";

const qc = new QueryClient();

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
      value={i18n.language.startsWith("zh") ? "zh-CN" : "en"}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="zh-CN">中文</option>
      <option value="en">English</option>
    </select>
  );
}

type Tab = "providers" | "cli";

function translateMessage(msg: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (msg === "SUCCESS") return t("common.test_success_msg");
  if (msg.startsWith("FAILED_HTTP:")) return t("common.test_failed_http", { code: msg.slice(12) });
  if (msg === "INTERRUPTED") return t("common.test_interrupted");
  if (msg === "SERVER_UNREACHABLE") return t("common.test_server_unreachable");
  if (msg === "TIMEOUT") return t("common.test_timeout");
  if (msg.startsWith("ERROR:")) return t("common.test_error", { detail: msg.slice(6) });
  return msg;
}

function AppInner() {
  const { t } = useTranslation();
  const { data: providers = [], isLoading, error } = useProviders();
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const del = useDeleteProvider();
  const toggle = useToggleProvider();
  const test = useTestConnection();
  const testAll = useTestAll();
  const reorder = useReorderProviders();
  const exportProviders = useExportProviders();
  const importProviders = useImportProviders();

  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);
  const [localProviders, setLocalProviders] = useState<Provider[]>([]);
  const [tab, setTab] = useState<Tab>("providers");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (providers.length > 0) {
      setLocalProviders(providers);
    }
  }, [providers]);

  useEffect(() => {
    const isTauri = "__TAURI__" in window;
    if (!isTauri) return;
    const handleBeforeUnload = () => {
      navigator.sendBeacon(`${API_BASE}/api/shutdown`);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function handleSave(config: ProviderConfig) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, config });
      setEditing(null);
    } else {
      await create.mutateAsync(config);
      setCreating(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localProviders.findIndex((p) => p.id === active.id);
    const newIndex = localProviders.findIndex((p) => p.id === over.id);
    const newProviders = arrayMove(localProviders, oldIndex, newIndex);
    setLocalProviders(newProviders);
    reorder.mutate(newProviders.map((p) => p.id));
  }

  async function handleTestAll() {
    const ids = localProviders.map((p) => p.id);
    if (ids.length === 0) return;
    try {
      const results = await testAll.mutateAsync(ids);
      for (const { id, result } of results) {
        const provider = localProviders.find((p) => p.id === id);
        addToast({
          type: result.success ? "success" : "error",
          message: `${provider?.name ?? id} ${translateMessage(result.message, t)}`,
          detail: result.success && result.latencyMs >= 0 ? `${result.latencyMs}ms` : undefined,
        });
      }
    } catch {
      addToast({ type: "error", message: t("common.test_failed") });
    }
  }

  async function handleExport() {
    try {
      const data = await exportProviders.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `routerclaude-providers-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", message: t("provider.export_success") });
    } catch {
      addToast({ type: "error", message: t("provider.export_failed") });
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.providers || !Array.isArray(data.providers)) {
        addToast({ type: "error", message: t("provider.import_empty") });
        return;
      }
      const result = await importProviders.mutateAsync(data);
      addToast({
        type: "success",
        message: t("provider.import_success", { imported: result.imported, skipped: result.skipped }),
      });
    } catch {
      addToast({ type: "error", message: t("provider.import_failed") });
    }
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl border border-red-100">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{t("backend.error")}: {error.message}</span>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "providers", label: t("nav.providers") },
    { key: "cli", label: t("nav.cli") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 p-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {t("app.title")}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{t("app.subtitle")}</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200"
              title={t("settings.title")}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
          {!showSettings && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 bg-white/60 rounded-xl p-0.5 border border-gray-100">
                {tabs.map((tb) => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                      tab === tb.key
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
              <LanguageSwitcher />
            </div>
          )}
        </div>

        {showSettings ? (
          <SettingsPanel onBack={() => setShowSettings(false)} onToast={addToast} />
        ) : (
          <>
            {tab === "providers" && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {!creating && !editing && (
                    <>
                      <button
                        onClick={() => setCreating(true)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 transition-all duration-200"
                      >
                        + {t("provider.add")}
                      </button>
                      <button
                        onClick={handleTestAll}
                        disabled={testAll.isPending || localProviders.length === 0}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testAll.isPending ? t("common.testing") : t("common.test_all")}
                      </button>
                      <button
                        onClick={handleExport}
                        disabled={exportProviders.isPending || localProviders.length === 0}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("provider.export")}
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importProviders.isPending}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("provider.import")}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                {(() => {
                  const allTags = Array.from(new Set(localProviders.flatMap((p) => p.tags ?? []))).sort();
                  if (allTags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        onClick={() => setFilterTag(null)}
                        className={`px-3 py-1 text-xs rounded-full border transition-all duration-200 ${
                          filterTag === null
                            ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {t("common.all")}
                      </button>
                      {allTags.map((tag) => {
                        const c = getTagColor(tag);
                        const active = filterTag === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => setFilterTag(active ? null : tag)}
                            className={`px-3 py-1 text-xs rounded-full border transition-all duration-200 ${
                              active
                                ? "bg-gray-800 text-white border-gray-800"
                                : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {creating ? (
                  <div className="border border-gray-100 rounded-2xl p-6 bg-white/80 shadow-sm">
                    <h2 className="font-semibold mb-5 text-gray-800">{t("provider.new")}</h2>
                    <ProviderForm
                      onSave={handleSave}
                      onCancel={() => setCreating(false)}
                      onToast={addToast}
                    />
                  </div>
                ) : editing ? (
                  <div className="border border-gray-100 rounded-2xl p-6 bg-white/80 shadow-sm">
                    <h2 className="font-semibold mb-5 text-gray-800">{t("provider.edit")}</h2>
                    <ProviderForm
                      initial={editing}
                      onSave={handleSave}
                      onCancel={() => setEditing(null)}
                      onToast={addToast}
                    />
                  </div>
                ) : (filterTag ? localProviders.filter((p) => p.tags?.includes(filterTag)) : localProviders).length === 0 ? (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm">{t("provider.empty")}</p>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={(filterTag ? localProviders.filter((p) => p.tags?.includes(filterTag)) : localProviders).map((p) => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4">
                        {(filterTag ? localProviders.filter((p) => p.tags?.includes(filterTag)) : localProviders).map((p) => (
                          <ProviderCard
                            key={p.id}
                            provider={p}
                            onToggle={(enabled) => toggle.mutate({ id: p.id, enabled })}
                            onEdit={() => setEditing(p)}
                            onDelete={() => {
                              if (confirm(t("provider.delete_confirm", { name: p.name }))) {
                                del.mutate(p.id);
                              }
                            }}
                            onTest={async () => {
                              const result = await test.mutateAsync(p.id);
                              addToast({
                                type: result.success ? "success" : "error",
                                message: `${p.name} ${translateMessage(result.message, t)}`,
                                detail: result.success && result.latencyMs >= 0 ? `${result.latencyMs}ms` : undefined,
                              });
                              return result;
                            }}
                            toggling={toggle.isPending}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </>
            )}

            {tab === "cli" && <ClaudeCliPanel onToast={addToast} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  );
}
