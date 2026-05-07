import { useTranslation } from "react-i18next";
import type { Model } from "../types/provider";

interface Props {
  models: Model[];
  onChange: (models: Model[]) => void;
}

export default function ModelEditor({ models, onChange }: Props) {
  const { t } = useTranslation();

  function update(index: number, field: keyof Model, value: string | boolean) {
    const next = models.map((m, i) =>
      i === index ? { ...m, [field]: value } : m,
    );
    onChange(next);
  }

  function remove(index: number) {
    onChange(models.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...models, { name: "", supports1m: false }]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t("provider.models")}
      </label>
      <div className="space-y-2.5">
        {models.map((model, i) => (
          <div key={i} className="flex items-center gap-2.5 group/model">
            <input
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 outline-none"
              placeholder={t("provider.model_name_placeholder")}
              value={model.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <label className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={model.supports1m}
                onChange={(e) => update(i, "supports1m", e.target.checked)}
                className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-200 transition-colors"
              />
              <span>{t("provider.1m_context")}</span>
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover/model:opacity-100 transition-all duration-200"
              title={t("provider.delete_model")}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        {t("provider.add_model")}
      </button>
    </div>
  );
}
