export interface ClaudeCliProvider {
  id: string;
  name: string;
  baseUrl: string;
  authToken: string;
  apiMode?: "openai" | "anthropic";
  proxyToken?: string;
  defaultModel?: string;
  defaultSonnetModel?: string;
  defaultOpusModel?: string;
  defaultHaikuModel?: string;
  defaultModel1m?: boolean;
  defaultSonnetModel1m?: boolean;
  defaultOpusModel1m?: boolean;
  defaultHaikuModel1m?: boolean;
  enabled: boolean;
  tags?: string[];
}

export interface ClaudeCliConfig {
  name: string;
  baseUrl: string;
  authToken: string;
  apiMode?: "openai" | "anthropic";
  defaultModel?: string;
  defaultSonnetModel?: string;
  defaultOpusModel?: string;
  defaultHaikuModel?: string;
  defaultModel1m?: boolean;
  defaultSonnetModel1m?: boolean;
  defaultOpusModel1m?: boolean;
  defaultHaikuModel1m?: boolean;
  tags?: string[];
}
