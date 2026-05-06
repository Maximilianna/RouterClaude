import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Provider, ProviderConfig } from "../types/provider";
import { API_BASE } from "../config";

const API = `${API_BASE}/api/providers`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || "请求失败");
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
