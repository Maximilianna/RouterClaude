import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  useClaudeCliProviders,
  useCreateClaudeCliProvider,
  useUpdateClaudeCliProvider,
  useDeleteClaudeCliProvider,
  useToggleClaudeCliProvider,
  useTestClaudeCliConnection,
  useTestAllClaudeCli,
  useReorderClaudeCliProviders,
  useExportClaudeCliProviders,
  useImportClaudeCliProviders,
} from "../hooks/useClaudeCli";
import ClaudeCliCard from "./ClaudeCliCard";
import ClaudeCliForm from "./ClaudeCliForm";
import type { ClaudeCliProvider, ClaudeCliConfig } from "../types/claudeCli";
import { getTagColor } from "../utils/tagColors";

function translateMessage(msg: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (msg === "SUCCESS") return t("common.test_success_msg");
  if (msg.startsWith("FAILED_HTTP:")) return t("common.test_failed_http", { code: msg.slice(12) });
  if (msg === "INTERRUPTED") return t("common.test_interrupted");
  if (msg === "SERVER_UNREACHABLE") return t("common.test_server_unreachable");
  if (msg === "TIMEOUT") return t("common.test_timeout");
  if (msg.startsWith("ERROR:")) return t("common.test_error", { detail: msg.slice(6) });
  return msg;
}

interface Props {
  onToast: (toast: { type: "success" | "error"; message: string; detail?: string }) => void;
}

export default function ClaudeCliPanel({ onToast }: Props) {
  const { t } = useTranslation();
  const { data: providers = [], isLoading, error } = useClaudeCliProviders();
  const create = useCreateClaudeCliProvider();
  const update = useUpdateClaudeCliProvider();
  const del = useDeleteClaudeCliProvider();
  const toggle = useToggleClaudeCliProvider();
  const test = useTestClaudeCliConnection();
  const testAll = useTestAllClaudeCli();
  const reorder = useReorderClaudeCliProviders();
  const exportProviders = useExportClaudeCliProviders();
  const importProviders = useImportClaudeCliProviders();

  const [editing, setEditing] = useState<ClaudeCliProvider | null>(null);
  const [creating, setCreating] = useState(false);
  const [localProviders, setLocalProviders] = useState<ClaudeCliProvider[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (providers.length > 0) {
      setLocalProviders(providers);
    }
  }, [providers]);

  async function handleSave(config: ClaudeCliConfig) {
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
        onToast({
          type: result.success ? "success" : "error",
          message: `${provider?.name ?? id} ${translateMessage(result.message, t)}`,
          detail: result.success && result.latencyMs >= 0 ? `${result.latencyMs}ms` : undefined,
        });
      }
    } catch {
      onToast({ type: "error", message: t("common.test_failed") });
    }
  }

  async function handleExport() {
    try {
      const data = await exportProviders.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `routerclaude-cli-providers-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onToast({ type: "success", message: t("cli.export_success") });
    } catch {
      onToast({ type: "error", message: t("cli.export_failed") });
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.providers || !Array.isArray(data.providers)) {
        onToast({ type: "error", message: t("cli.import_empty") });
        return;
      }
      const result = await importProviders.mutateAsync(data);
      onToast({
        type: "success",
        message: t("cli.import_success", { imported: result.imported, skipped: result.skipped }),
      });
    } catch {
      onToast({ type: "error", message: t("cli.import_failed") });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800">
          <span className="text-sm">{error.message}</span>
        </div>
      </div>
    );
  }

  const allTags = Array.from(new Set(localProviders.flatMap((p) => p.tags ?? []))).sort();

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        {!creating && !editing && (
          <>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 dark:shadow-blue-900/50 hover:shadow-md hover:shadow-blue-200 transition-all duration-200"
            >
              + {t("cli.add")}
            </button>
            <button
              onClick={handleTestAll}
              disabled={testAll.isPending || localProviders.length === 0}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testAll.isPending ? t("common.testing") : t("common.test_all")}
            </button>
            <button
              onClick={handleExport}
              disabled={exportProviders.isPending || localProviders.length === 0}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("cli.export")}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importProviders.isPending}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("cli.import")}
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

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-3 py-1 text-xs rounded-full border transition-all duration-200 ${
              filterTag === null
                ? "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
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
                    ? "bg-gray-800 text-white border-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200"
                    : `${c.bg} ${c.text} ${c.border} ${c.darkBg} ${c.darkText} ${c.darkBorder} hover:opacity-80`
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {creating ? (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-6 bg-white/80 dark:bg-gray-800/80 shadow-sm">
          <h2 className="font-semibold mb-5 text-gray-800 dark:text-gray-100">{t("cli.new")}</h2>
          <ClaudeCliForm
            onSave={handleSave}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : editing ? (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-6 bg-white/80 dark:bg-gray-800/80 shadow-sm">
          <h2 className="font-semibold mb-5 text-gray-800 dark:text-gray-100">{t("cli.edit")}</h2>
          <ClaudeCliForm
            initial={editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (filterTag ? localProviders.filter((p) => p.tags?.includes(filterTag)) : localProviders).length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
            <svg className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">{t("cli.empty")}</p>
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
                <ClaudeCliCard
                  key={p.id}
                  provider={p}
                  onToggle={(enabled) => toggle.mutate({ id: p.id, enabled })}
                  onEdit={() => setEditing(p)}
                  onDelete={() => {
                    if (confirm(t("cli.delete_confirm", { name: p.name }))) {
                      del.mutate(p.id);
                    }
                  }}
                  onTest={async () => {
                    const result = await test.mutateAsync(p.id);
                    onToast({
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
    </div>
  );
}
