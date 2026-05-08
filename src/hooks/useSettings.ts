import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../config";

const API = `${API_BASE}/api/settings`;

export interface AppSettings {
  retryMaxAttempts: number;
  retryDelayMs: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheMaxEntries: number;
}

export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(API);
      if (!res.ok) throw new Error("FETCH_SETTINGS_FAILED");
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partial: Partial<AppSettings>) => {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error("SAVE_SETTINGS_FAILED");
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
