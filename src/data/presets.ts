export interface ProviderPreset {
  name: string;
  openaiUrl: string;
  anthropicUrl: string;
  cliUrl: string;
  defaultApiMode: "openai" | "anthropic";
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "DeepSeek",
    openaiUrl: "https://api.deepseek.com",
    anthropicUrl: "https://api.deepseek.com/anthropic",
    cliUrl: "https://api.deepseek.com",
    defaultApiMode: "openai",
  },
  {
    name: "Mimo",
    openaiUrl: "https://api.xiaomimimo.com/v1",
    anthropicUrl: "https://api.xiaomimimo.com/anthropic",
    cliUrl: "https://api.xiaomimimo.com/v1",
    defaultApiMode: "openai",
  },
  {
    name: "Mimo (Token Plan)",
    openaiUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    anthropicUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
    cliUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    defaultApiMode: "openai",
  },
  {
    name: "GLM",
    openaiUrl: "https://open.bigmodel.cn/api/paas/v4",
    anthropicUrl: "https://open.bigmodel.cn/api/anthropic",
    cliUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultApiMode: "openai",
  },
  {
    name: "Kimi",
    openaiUrl: "https://api.moonshot.cn/v1",
    anthropicUrl: "https://api.moonshot.cn/anthropic",
    cliUrl: "https://api.moonshot.cn/v1",
    defaultApiMode: "openai",
  },
  {
    name: "MiniMax",
    openaiUrl: "https://api.minimaxi.com/v1",
    anthropicUrl: "https://api.minimaxi.com/anthropic",
    cliUrl: "https://api.minimaxi.com/v1",
    defaultApiMode: "openai",
  },
];
