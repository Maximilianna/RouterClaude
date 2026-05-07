export interface Model {
  name: string;
  supports1m: boolean;
}

export interface Provider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  models: Model[];
  enabled: boolean;
  apiMode?: "openai" | "anthropic";
  tags?: string[];
}

export interface ProviderConfig {
  name: string;
  apiUrl: string;
  apiKey: string;
  models: Model[];
  apiMode?: "openai" | "anthropic";
  tags?: string[];
}

export interface DiscoverResult {
  models: string[];
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  totalRequests: number;
  errorRate: number;
  startupError?: string;
}

export interface ProxyLogEntry {
  timestamp: number;
  model: string;
  providerName: string;
  statusCode: number;
  latencyMs: number;
  isError: boolean;
}

export interface UsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  requestCount: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export interface UsageRecord {
  timestamp: number;
  providerName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type ApiMode = "openai" | "anthropic";
