import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderConfig } from "../types/provider";
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
      setError(err instanceof Error ? err.message : t("common.saving"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("provider.name")}
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder={t("provider.name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("provider.api_url")}
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder={t("provider.api_url_placeholder")}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("provider.api_key")}
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder={t("provider.api_key_placeholder")}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <ModelEditor models={models} onChange={setModels} />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("common.saving") : initial ? t("common.update") : t("common.create")}
        </button>
      </div>
    </form>
  );
}
