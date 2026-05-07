import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
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
  useReorderProviders,
} from "./hooks/useProviders";
import ProviderCard from "./components/ProviderCard";
import ProviderForm from "./components/ProviderForm";
import type { Provider, ProviderConfig } from "./types/provider";
import { API_BASE } from "./config";

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

function AppInner() {
  const { t } = useTranslation();
  const { data: providers = [], isLoading, error } = useProviders();
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const del = useDeleteProvider();
  const toggle = useToggleProvider();
  const test = useTestConnection();
  const reorder = useReorderProviders();

  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);
  const [localProviders, setLocalProviders] = useState<Provider[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sync with server data
  useEffect(() => {
    if (providers.length > 0) {
      setLocalProviders(providers);
    }
  }, [providers]);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {t("app.title")}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{t("app.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 transition-all duration-200"
              >
                + {t("provider.add")}
              </button>
            )}
          </div>
        </div>

        {creating ? (
          <div className="border border-gray-100 rounded-2xl p-6 bg-white/80 backdrop-blur-sm shadow-sm">
            <h2 className="font-semibold mb-5 text-gray-800">{t("provider.new")}</h2>
            <ProviderForm
              onSave={handleSave}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : editing ? (
          <div className="border border-gray-100 rounded-2xl p-6 bg-white/80 backdrop-blur-sm shadow-sm">
            <h2 className="font-semibold mb-5 text-gray-800">{t("provider.edit")}</h2>
            <ProviderForm
              initial={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : localProviders.length === 0 ? (
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
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localProviders.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {localProviders.map((p) => (
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
                    onTest={() => test.mutateAsync(p.id)}
                    toggling={toggle.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
