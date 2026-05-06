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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t("provider.models")}
      </label>
      <div className="space-y-2">
        {models.map((model, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder={t("provider.model_name_placeholder")}
              value={model.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <label className="flex items-center gap-1 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={model.supports1m}
                onChange={(e) => update(i, "supports1m", e.target.checked)}
              />
              {t("provider.1m_context")}
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-red-500 hover:text-red-700 text-lg leading-none"
              title={t("provider.delete_model")}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
      >
        {t("provider.add_model")}
      </button>
    </div>
  );
}
