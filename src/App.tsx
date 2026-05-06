import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
  useDeleteProvider,
  useToggleProvider,
} from "./hooks/useProviders";
import ProviderCard from "./components/ProviderCard";
import ProviderForm from "./components/ProviderForm";
import type { Provider, ProviderConfig } from "./types/provider";

const qc = new QueryClient();

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      className="text-xs border rounded px-1 py-0.5"
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

  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleSave(config: ProviderConfig) {
    if (editing) {
      await update.mutateAsync({ id: editing.id, config });
      setEditing(null);
    } else {
      await create.mutateAsync(config);
      setCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {t("backend.error")}: {error.message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("app.title")}</h1>
            <p className="text-sm text-gray-500">{t("app.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                + {t("provider.add")}
              </button>
            )}
          </div>
        </div>

        {creating && (
          <div className="border rounded-lg p-4 bg-white mb-4">
            <h2 className="font-semibold mb-4">{t("provider.new")}</h2>
            <ProviderForm
              onSave={handleSave}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {editing && (
          <div className="border rounded-lg p-4 bg-white mb-4">
            <h2 className="font-semibold mb-4">{t("provider.edit")}</h2>
            <ProviderForm
              initial={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {providers.length === 0 && !creating ? (
          <div className="text-center text-gray-400 py-16">
            {t("provider.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) =>
              editing?.id === p.id ? null : (
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
                  toggling={toggle.isPending}
                />
              ),
            )}
          </div>
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
