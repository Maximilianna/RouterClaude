export interface ProviderPreset {
  name: string;
  openaiUrl: string;
  anthropicUrl: string;
  defaultApiMode: "openai" | "anthropic";
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "DeepSeek",
    openaiUrl: "https://api.deepseek.com",
    anthropicUrl: "https://api.deepseek.com/anthropic",
    defaultApiMode: "openai",
  },
  {
    name: "Mimo",
    openaiUrl: "https://api.xiaomimimo.com/v1",
    anthropicUrl: "https://api.xiaomimimo.com/anthropic",
    defaultApiMode: "openai",
  },
  {
    name: "Mimo (Token Plan)",
    openaiUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    anthropicUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
    defaultApiMode: "openai",
  },
  {
    name: "GLM",
    openaiUrl: "https://open.bigmodel.cn/api/paas/v4",
    anthropicUrl: "https://open.bigmodel.cn/api/anthropic",
    defaultApiMode: "openai",
  },
  {
    name: "Kimi",
    openaiUrl: "https://api.moonshot.cn/v1",
    anthropicUrl: "https://api.moonshot.cn/anthropic",
    defaultApiMode: "openai",
  },
  {
    name: "MiniMax",
    openaiUrl: "https://api.minimaxi.com/v1",
    anthropicUrl: "https://api.minimaxi.com/anthropic",
    defaultApiMode: "openai",
  },
];
