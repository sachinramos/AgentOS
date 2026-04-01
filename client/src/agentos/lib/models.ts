export const PROVIDER_MODELS: Record<string, string[]> = {
  OpenAI: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini", "o3-mini"],
  Anthropic: ["claude-4-sonnet", "claude-4-opus", "claude-3.7-sonnet", "claude-3.5-sonnet", "claude-3.5-haiku"],
  Google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  xAI: ["grok-3", "grok-3-mini", "grok-2"],
  Amazon: ["nova-pro", "nova-lite", "nova-micro"],
  "Alibaba (Qwen)": ["qwen-3", "qwen-2.5-max", "qwen-2.5-plus"],
  Microsoft: ["phi-4", "phi-4-mini"],
  Mistral: ["mistral-large", "mistral-medium", "mistral-small", "codestral"],
  Meta: ["llama-4-maverick", "llama-4-scout", "llama-3.3-70b", "llama-3.1-405b", "llama-3.1-70b"],
  Perplexity: ["sonar-pro", "sonar", "sonar-reasoning-pro"],
  AI21: ["jamba-2.0-large", "jamba-2.0-mini"],
  DeepSeek: ["deepseek-r1", "deepseek-v3", "deepseek-chat"],
  Kimi: ["kimi-k2", "moonshot-v1-128k", "moonshot-v1-32k"],
  Manus: ["manus-1"],
  Cohere: ["command-r-plus", "command-r", "command-a"],
  Sarvam: ["sarvam-1", "sarvam-m", "sarvam-30b", "sarvam-105b"],
  Custom: ["custom"],
};

export const DEFAULT_PROVIDER = "OpenAI";
export const DEFAULT_MODEL = "gpt-4.1";
