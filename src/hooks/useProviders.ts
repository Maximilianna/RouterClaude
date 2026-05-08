import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Provider,
  ProviderConfig,
  DiscoverResult,
  ProxyStatus,
  ProxyLogEntry,
  UsageSummary,
  UsageRecord,
} from "../types/provider";
import { API_BASE } from "../config";

const API = `${API_BASE}/api/providers`;
const PROXY_API = `${API_BASE}/api/proxy`;
const USAGE_API = `${API_BASE}/api/usage`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "REQUEST_FAILED");
  }
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

export function useProviders() {
  return useQuery<Provider[]>({
    queryKey: ["providers"],
    queryFn: () => request<Provider[]>(API),
  });
}

export function useActiveProvider() {
  return useQuery<Provider | null>({
    queryKey: ["providers", "active"],
    queryFn: async () => {
      const res = await fetch(`${API}/active`);
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? (JSON.parse(text) as Provider) : null;
    },
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ProviderConfig) =>
      request<Provider>(API, {
        method: "POST",
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, config }: { id: string; config: ProviderConfig }) =>
      request<undefined>(`${API}/${id}`, {
        method: "PUT",
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<undefined>(`${API}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers", "active"] });
    },
  });
}

export function useToggleProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request<undefined>(`${API}/${id}/toggle?enabled=${enabled}`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers", "active"] });
    },
  });
}

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      request<TestResult>(`${API}/${id}/test`, { method: "POST" }),
  });
}

export function useReorderProviders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      request<undefined>(`${API}/reorder`, {
        method: "POST",
        body: JSON.stringify(ids),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useDiscoverModels() {
  return useMutation({
    mutationFn: (params: { apiUrl: string; apiKey: string; apiMode?: string }) =>
      request<DiscoverResult>(`${API}/discover`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });
}

export function useTestAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          request<TestResult>(`${API}/${id}/test`, { method: "POST" })
        )
      );
      return ids.map((id, i) => ({
        id,
        result:
          results[i].status === "fulfilled"
            ? (results[i] as PromiseFulfilledResult<TestResult>).value
            : { success: false, message: "ERROR", latencyMs: -1 },
      }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useProxyStatus() {
  return useQuery<ProxyStatus>({
    queryKey: ["proxy", "status"],
    queryFn: () => request<ProxyStatus>(`${PROXY_API}/status`),
    refetchInterval: 5000,
  });
}

export function useProxyLogs(limit = 100) {
  return useQuery<ProxyLogEntry[]>({
    queryKey: ["proxy", "logs", limit],
    queryFn: () => request<ProxyLogEntry[]>(`${PROXY_API}/logs?limit=${limit}`),
    refetchInterval: 5000,
  });
}

export function useUsageSummary(period = "today") {
  return useQuery<UsageSummary>({
    queryKey: ["usage", "summary", period],
    queryFn: () => request<UsageSummary>(`${USAGE_API}/summary?period=${period}`),
  });
}

export function useUsageDetails(limit = 50) {
  return useQuery<UsageRecord[]>({
    queryKey: ["usage", "details", limit],
    queryFn: () => request<UsageRecord[]>(`${USAGE_API}/details?limit=${limit}`),
  });
}

export interface ExportData {
  version: string;
  exportedAt: string;
  providers: ProviderConfig[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  names: string[];
}

export function useExportProviders() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/export`);
      if (!res.ok) throw new Error("EXPORT_FAILED");
      return res.json() as Promise<ExportData>;
    },
  });
}

export function useImportProviders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExportData) =>
      request<ImportResult>(`${API}/import`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}
