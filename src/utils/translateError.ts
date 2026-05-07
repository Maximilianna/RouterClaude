import type { TFunction } from "i18next";

const ERROR_MAP: Record<string, string> = {
  NAME_TAKEN: "error.name_taken",
  PROVIDER_NOT_FOUND: "error.provider_not_found",
  NAME_REQUIRED: "validation.name_required",
  API_URL_REQUIRED: "validation.api_url_required",
  API_URL_INVALID: "validation.api_url_invalid",
  API_KEY_REQUIRED: "validation.api_key_required",
  MODELS_REQUIRED: "validation.model_required",
  IO_ERROR: "error.io_error",
  REQUEST_FAILED: "error.request_failed",
};

export function translateBackendError(msg: string, t: TFunction): string {
  const key = ERROR_MAP[msg];
  if (key) return t(key);
  return msg;
}
