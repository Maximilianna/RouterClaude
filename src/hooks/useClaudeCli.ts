import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClaudeCliProvider, ClaudeCliConfig } from "../types/claudeCli";
import { API_BASE } from "../config";

const API = `${API_BASE}/api/claude-cli`;

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

export interface TestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  providers: ClaudeCliConfig[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  names: string[];
}

export function useClaudeCliProviders() {
  return useQuery<ClaudeCliProvider[]>({
    queryKey: ["clacli"],
    queryFn: () => request<ClaudeCliProvider[]>(API),
  });
}

export function useActiveClaudeCliProvider() {
  return useQuery<ClaudeCliProvider | null>({
    queryKey: ["clacli", "active"],
    queryFn: async () => {
      const res = await fetch(`${API}/active`);
      if (res.status === 204 || res.status === 200) {
        const text = await res.text();
        return text ? (JSON.parse(text) as ClaudeCliProvider) : null;
      }
      return null;
    },
  });
}

export function useCreateClaudeCliProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ClaudeCliConfig) =>
      request<ClaudeCliProvider>(API, {
        method: "POST",
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
    },
  });
}

export function useUpdateClaudeCliProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, config }: { id: string; config: ClaudeCliConfig }) =>
      request<undefined>(`${API}/${id}`, {
        method: "PUT",
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
      qc.invalidateQueries({ queryKey: ["clacli", "active"] });
    },
  });
}

export function useDeleteClaudeCliProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<undefined>(`${API}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
      qc.invalidateQueries({ queryKey: ["clacli", "active"] });
    },
  });
}

export function useToggleClaudeCliProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      request<undefined>(`${API}/${id}/toggle?enabled=${enabled}`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
      qc.invalidateQueries({ queryKey: ["clacli", "active"] });
    },
  });
}

export function useTestClaudeCliConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      request<TestResult>(`${API}/${id}/test`, { method: "POST" }),
  });
}

export function useTestAllClaudeCli() {
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
  });
}

export function useDiscoverCliModels() {
  return useMutation({
    mutationFn: (params: { baseUrl: string; authToken: string; apiMode?: string }) =>
      request<{ models: string[] }>(`${API}/discover`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });
}

export function useReorderClaudeCliProviders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      request<undefined>(`${API}/reorder`, {
        method: "POST",
        body: JSON.stringify(ids),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
    },
  });
}

export function useExportClaudeCliProviders() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/export`);
      if (!res.ok) throw new Error("EXPORT_FAILED");
      return res.json() as Promise<ExportData>;
    },
  });
}

export function useImportClaudeCliProviders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExportData) =>
      request<ImportResult>(`${API}/import`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clacli"] });
    },
  });
}
