import { useTranslation } from "react-i18next";
import type { Provider } from "../types/provider";

interface Props {
  provider: Provider;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  toggling?: boolean;
}

export default function ProviderCard({
  provider,
  onToggle,
  onEdit,
  onDelete,
  toggling,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              provider.enabled ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <h3 className="font-semibold">{provider.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={provider.enabled}
              disabled={toggling}
              onChange={(e) => onToggle(e.target.checked)}
            />
            {t("common.enable")}
          </label>
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t("common.edit")}
          </button>
          <button
            onClick={onDelete}
            className="text-sm text-red-500 hover:text-red-700"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 truncate">{provider.apiUrl}</p>
      {provider.models.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {provider.models.map((m) => (
            <span
              key={m.name}
              className="inline-block bg-gray-100 text-xs px-2 py-0.5 rounded"
            >
              {m.name}
              {m.supports1m && (
                <span className="ml-1 text-blue-500 font-medium">
                  {t("provider.1m_context")}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
