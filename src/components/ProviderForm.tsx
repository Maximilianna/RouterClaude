import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderConfig } from "../types/provider";
import { translateBackendError } from "../utils/translateError";
import ModelEditor from "./ModelEditor";

interface Props {
  initial?: Provider;
  onSave: (config: ProviderConfig) => Promise<void>;
  onCancel: () => void;
}

export default function ProviderForm({ initial, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [models, setModels] = useState(initial?.models ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("validation.name_required"));
      return;
    }
    if (!apiUrl.trim()) {
      setError(t("validation.api_url_required"));
      return;
    }
    if (!/^https?:\/\/.+/.test(apiUrl.trim())) {
      setError(t("validation.api_url_invalid"));
      return;
    }
    if (!apiKey.trim()) {
      setError(t("validation.api_key_required"));
      return;
    }
    if (models.length === 0 || models.every((m) => !m.name.trim())) {
      setError(t("validation.model_required"));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
        models: models.filter((m) => m.name.trim()),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.saving");
      setError(translateBackendError(msg, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("provider.name")}
        </label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 outline-none"
          placeholder={t("provider.name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("provider.api_url")}
        </label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 outline-none"
          placeholder={t("provider.api_url_placeholder")}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("provider.api_key")}
        </label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 outline-none"
          type="password"
          placeholder={t("provider.api_key_placeholder")}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <ModelEditor models={models} onChange={setModels} />

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {saving ? t("common.saving") : initial ? t("common.update") : t("common.create")}
        </button>
      </div>
    </form>
  );
}
