import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../config";

const API = `${API_BASE}/api/lb`;

export interface LbEntry {
  providerId: string;
  models: string[];
  weight: number;
}

export interface LbConfig {
  lbEnabled: boolean;
  lbStrategy: "round_robin" | "weighted" | "lowest_latency";
  lbCcdEntries: LbEntry[];
  lbCcEntries: LbEntry[];
}

export interface LbProvider {
  id: string;
  name: string;
  enabled: boolean;
  models: string[];
}

export function useLbConfig() {
  return useQuery<LbConfig>({
    queryKey: ["lbConfig"],
    queryFn: async () => {
      const res = await fetch(`${API}/config`);
      if (!res.ok) throw new Error("FETCH_LB_CONFIG_FAILED");
      return res.json();
    },
  });
}

export function useUpdateLbConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partial: Partial<LbConfig>) => {
      const res = await fetch(`${API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error("SAVE_LB_CONFIG_FAILED");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lbConfig"] });
    },
  });
}

export function useLbProviders(type: "ccd" | "cc") {
  return useQuery<LbProvider[]>({
    queryKey: ["lbProviders", type],
    queryFn: async () => {
      const res = await fetch(`${API}/providers?type=${type}`);
      if (!res.ok) throw new Error("FETCH_LB_PROVIDERS_FAILED");
      return res.json();
    },
  });
}
