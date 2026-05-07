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
  DISCOVER_INVALID_RESPONSE: "error.discover_invalid_response",
};

export function translateBackendError(msg: string, t: TFunction): string {
  const key = ERROR_MAP[msg];
  if (key) return t(key);
  // Handle prefixed errors like "DISCOVER_FAILED:401"
  const prefix = msg.split(":")[0];
  const prefixKey = ERROR_MAP[prefix];
  if (prefixKey) return t(prefixKey);
  return msg;
}
