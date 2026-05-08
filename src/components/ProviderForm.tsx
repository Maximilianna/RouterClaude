import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderConfig, ApiMode, Model } from "../types/provider";
import { translateBackendError } from "../utils/translateError";
import { PROVIDER_PRESETS } from "../data/presets";
import { useDiscoverModels } from "../hooks/useProviders";
import { getTagColor } from "../utils/tagColors";
import ModelEditor from "./ModelEditor";

interface Props {
  initial?: Provider;
  onSave: (config: ProviderConfig) => Promise<void>;
  onCancel: () => void;
  onToast?: (toast: { type: "success" | "error"; message: string; detail?: string }) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

export default function ProviderForm({ initial, onSave, onCancel, onToast }: Props) {
  const { t } = useTranslation();
  const discover = useDiscoverModels();

  const [name, setName] = useState(initial?.name ?? "");
  const [apiUrl, setApiUrl] = useState(initial?.apiUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [models, setModels] = useState<Model[]>(initial?.models ?? []);
  const [apiMode, setApiMode] = useState<ApiMode>(initial?.apiMode ?? "openai");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);

  function handlePresetChange(presetName: string) {
    setSelectedPreset(presetName);
    const preset = PROVIDER_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setName(preset.name);
    setApiMode(preset.defaultApiMode);
    setApiUrl(preset.defaultApiMode === "openai" ? preset.openaiUrl : preset.anthropicUrl);
  }

  function handleApiModeChange(mode: ApiMode) {
    setApiMode(mode);
    const preset = PROVIDER_PRESETS.find((p) => p.name === selectedPreset || p.name === name);
    if (preset) {
      setApiUrl(mode === "openai" ? preset.openaiUrl : preset.anthropicUrl);
    }
  }

  async function handleDiscover() {
    if (!apiKey.trim()) return;
    const preset = PROVIDER_PRESETS.find((p) => p.name === selectedPreset || p.name === name);
    const discoverUrl = preset ? preset.openaiUrl : apiUrl.trim();
    if (!discoverUrl) return;

    try {
      const result = await discover.mutateAsync({
        apiUrl: discoverUrl,
        apiKey: apiKey.trim(),
        apiMode: "openai",
      });
      const newModels: Model[] = result.models.map((name) => ({
        name,
        supports1m: false,
      }));
      setModels(newModels);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DISCOVER_FAILED";
      onToast?.({
        type: "error",
        message: t("error.discover_not_supported"),
        detail: translateBackendError(msg, t),
      });
    }
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = t("validation.name_required");
    }
    if (!apiUrl.trim()) {
      newErrors.apiUrl = t("validation.api_url_required");
    } else if (!/^https?:\/\/.+/.test(apiUrl.trim())) {
      newErrors.apiUrl = t("validation.api_url_invalid");
    }
    if (!apiKey.trim()) {
      newErrors.apiKey = t("validation.api_key_required");
    }
    if (models.length === 0 || models.every((m) => !m.name.trim())) {
      newErrors.models = t("validation.model_required");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
        models: models.filter((m) => m.name.trim()),
        apiMode,
        tags,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.saving");
      setServerError(translateBackendError(msg, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("provider.preset")}
          </label>
          <select
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 outline-none bg-white dark:bg-gray-700 dark:text-gray-200"
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <option value="">{t("provider.custom")}</option>
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("provider.name")}
        </label>
        <input
          className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 transition-all duration-200 outline-none dark:bg-gray-700 dark:text-gray-200 ${
            errors.name
              ? "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-900/30"
              : "border-gray-200 focus:border-blue-400 focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/50"
          }`}
          placeholder={t("provider.name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError message={errors.name} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("provider.api_mode")}
        </label>
        <div className="flex gap-3">
          {(["openai", "anthropic"] as ApiMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleApiModeChange(mode)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 ${
                apiMode === mode
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 dark:shadow-blue-900/50"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              {mode === "openai" ? "OpenAI" : "Anthropic"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("provider.api_url")}
        </label>
        <input
          className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 transition-all duration-200 outline-none dark:bg-gray-700 dark:text-gray-200 ${
            errors.apiUrl
              ? "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-900/30"
              : "border-gray-200 focus:border-blue-400 focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/50"
          }`}
          placeholder={t("provider.api_url_placeholder")}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
        <FieldError message={errors.apiUrl} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("provider.api_key")}
        </label>
        <div className="relative">
          <input
            className={`w-full border rounded-xl px-4 py-2.5 pr-10 text-sm font-mono focus:ring-2 transition-all duration-200 outline-none dark:bg-gray-700 dark:text-gray-200 ${
              errors.apiKey
                ? "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-900/30"
                : "border-gray-200 focus:border-blue-400 focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/50"
            }`}
            type={showApiKey ? "text" : "password"}
            placeholder={t("provider.api_key_placeholder")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            {showApiKey ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
        <FieldError message={errors.apiKey} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("provider.models")}
          </label>
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discover.isPending || !apiUrl.trim() || !apiKey.trim()}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discover.isPending ? t("provider.discovering") : t("provider.discover")}
          </button>
        </div>
        <ModelEditor models={models} onChange={setModels} />
        <FieldError message={errors.models} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("provider.tags")}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => {
            const c = getTagColor(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1 ${c.bg} ${c.text} ${c.darkBg} ${c.darkText} text-xs rounded-full border ${c.border} ${c.darkBorder}`}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 transition-all duration-200 outline-none dark:bg-gray-700 dark:text-gray-200"
            placeholder={t("provider.add_tag")}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
          >
            {t("common.add")}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl text-sm border border-red-100 dark:border-red-800">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition-all duration-200"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 dark:shadow-blue-900/50 hover:shadow-md hover:shadow-blue-200 dark:hover:shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {saving ? t("common.saving") : initial ? t("common.update") : t("common.create")}
        </button>
      </div>
    </form>
  );
}
