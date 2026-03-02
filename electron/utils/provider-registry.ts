/**
 * Provider Registry — single source of truth for backend provider metadata.
 * Centralizes env var mappings, default models, and OpenClaw provider configs.
 *
 * NOTE: When adding a new provider type, also update src/lib/providers.ts
 */

export const BUILTIN_PROVIDER_TYPES = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'moonshot',
  'siliconflow',
  'aliyun',
  'volcengine',
  'minimax-portal',
  'qwen-portal',
  'ollama',
  // Coding Plan types
  'volcengine-coding',
  'aliyun-coding',
  'zhipu-coding',
  'kimi-coding',
] as const;
export type BuiltinProviderType = (typeof BUILTIN_PROVIDER_TYPES)[number];
export type ProviderType = BuiltinProviderType | 'custom';

interface ProviderModelEntry extends Record<string, unknown> {
  id: string;
  name: string;
}


interface ProviderBackendMeta {
  envVar?: string;
  defaultModel?: string;
  /** OpenClaw models.providers config (omit for built-in providers like anthropic) */
  providerConfig?: {
    baseUrl: string;
    api: string;
    apiKeyEnv: string;
    models?: ProviderModelEntry[];
  };
  /** Curated list of popular model IDs to show when API /models listing fails or is unavailable */
  curatedModels?: string[];
}

const REGISTRY: Record<string, ProviderBackendMeta> = {
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'anthropic/claude-opus-4-6',
    curatedModels: [
      'claude-opus-4-6',
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
  },
  openai: {
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'openai/gpt-5.2',
    providerConfig: {
      baseUrl: 'https://api.openai.com/v1',
      api: 'openai-responses',
      apiKeyEnv: 'OPENAI_API_KEY',
    },
    curatedModels: [
      'gpt-5.2',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'o4-mini',
      'o3',
      'o3-mini',
      'gpt-4o',
      'gpt-4o-mini',
    ],
  },
  google: {
    envVar: 'GEMINI_API_KEY',
    defaultModel: 'google/gemini-3.1-pro-preview',
    curatedModels: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
  },
  openrouter: {
    envVar: 'OPENROUTER_API_KEY',
    defaultModel: 'openrouter/anthropic/claude-opus-4.6',
    providerConfig: {
      baseUrl: 'https://openrouter.ai/api/v1',
      api: 'openai-completions',
      apiKeyEnv: 'OPENROUTER_API_KEY',
    },
    curatedModels: [
      'anthropic/claude-opus-4-6',
      'anthropic/claude-sonnet-4-20250514',
      'openai/gpt-4.1',
      'openai/o3',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-chat',
      'meta-llama/llama-4-maverick',
    ],
  },
  moonshot: {
    envVar: 'MOONSHOT_API_KEY',
    defaultModel: 'moonshot/kimi-k2.5',
    providerConfig: {
      baseUrl: 'https://api.moonshot.cn/v1',
      api: 'openai-completions',
      apiKeyEnv: 'MOONSHOT_API_KEY',
      models: [
        {
          id: 'kimi-k2.5',
          name: 'Kimi K2.5',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 256000,
          maxTokens: 8192,
        },
      ],
    },
    curatedModels: [
      'kimi-k2.5',
      'moonshot-v1-auto',
      'moonshot-v1-128k',
      'moonshot-v1-32k',
      'moonshot-v1-8k',
    ],
  },
  siliconflow: {
    envVar: 'SILICONFLOW_API_KEY',
    defaultModel: 'siliconflow/deepseek-ai/DeepSeek-V3',
    providerConfig: {
      baseUrl: 'https://api.siliconflow.cn/v1',
      api: 'openai-completions',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
    },
    curatedModels: [
      'deepseek-ai/DeepSeek-V3-0324',
      'deepseek-ai/DeepSeek-R1',
      'Pro/deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen3-235B-A22B',
      'Qwen/Qwen3-32B',
      'Pro/moonshotai/Kimi-K2.5',
    ],
  },
  aliyun: {
    envVar: 'ALIYUN_API_KEY',
    defaultModel: 'aliyun/qwen-plus',
    providerConfig: {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api: 'openai-completions',
      apiKeyEnv: 'ALIYUN_API_KEY',
    },
    curatedModels: [
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen3-235b-a22b',
      'qwen3-32b',
      'qwen3-14b',
      'qwen2.5-coder-32b-instruct',
      'deepseek-v3',
      'deepseek-r1',
    ],
  },
  volcengine: {
    envVar: 'VOLCENGINE_API_KEY',
    defaultModel: 'volcengine/ep-xxxx',
    providerConfig: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      api: 'openai-completions',
      apiKeyEnv: 'VOLCENGINE_API_KEY',
    },
    curatedModels: [
      'doubao-1.5-pro-256k',
      'doubao-1.5-pro-32k',
      'doubao-1.5-lite-32k',
      'doubao-pro-256k',
      'doubao-pro-32k',
      'doubao-lite-32k',
      'deepseek-v3-241226',
      'deepseek-r1-250120',
      'deepseek-r1-distill-qwen-32b-250120',
    ],
  },
  'minimax-portal': {
    defaultModel: 'minimax-portal/MiniMax-M2.1',
  },
  'qwen-portal': {
    defaultModel: 'qwen-portal/coder-model',
  },
  ollama: {
    curatedModels: [],  // Ollama models are always dynamic (local), no curated list
  },
  custom: {
    envVar: 'CUSTOM_API_KEY',
    curatedModels: [],  // Custom providers have no curated list
  },
  // --- Coding Plan Providers ---
  'volcengine-coding': {
    envVar: 'VOLCENGINE_API_KEY',
    defaultModel: 'volcengine-coding/ark-code-latest',
    providerConfig: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      api: 'openai',
      apiKeyEnv: 'VOLCENGINE_API_KEY',
    },
    curatedModels: ['ark-code-latest'],
  },
  'aliyun-coding': {
    envVar: 'ALIYUN_CODING_API_KEY',
    defaultModel: 'aliyun-coding/qwen-coder-plus',
    providerConfig: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
      api: 'openai',
      apiKeyEnv: 'ALIYUN_CODING_API_KEY',
    },
    curatedModels: ['qwen-coder-plus', 'qwen-coder-turbo'],
  },
  'zhipu-coding': {
    envVar: 'ZHIPU_API_KEY',
    defaultModel: 'zhipu-coding/glm-4-plus',
    providerConfig: {
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      api: 'openai',
      apiKeyEnv: 'ZHIPU_API_KEY',
    },
    curatedModels: ['glm-4-plus', 'glm-4-flash', 'codegeex-4'],
  },
  'kimi-coding': {
    envVar: 'KIMI_API_KEY',
    defaultModel: 'kimi-coding/kimi-latest',
    providerConfig: {
      baseUrl: 'https://api.kimi.com/coding/v1',
      api: 'openai',
      apiKeyEnv: 'KIMI_API_KEY',
    },
    curatedModels: ['kimi-latest'],
  },
  // Additional providers with env var mappings but no default model
  groq: { envVar: 'GROQ_API_KEY' },
  deepgram: { envVar: 'DEEPGRAM_API_KEY' },
  cerebras: { envVar: 'CEREBRAS_API_KEY' },
  xai: { envVar: 'XAI_API_KEY' },
  mistral: { envVar: 'MISTRAL_API_KEY' },
};

/** Get the environment variable name for a provider type */
export function getProviderEnvVar(type: string): string | undefined {
  return REGISTRY[type]?.envVar;
}

/** Get the default model string for a provider type */
export function getProviderDefaultModel(type: string): string | undefined {
  return REGISTRY[type]?.defaultModel;
}

/** Get the OpenClaw provider config (baseUrl, api, apiKeyEnv, models) */
export function getProviderConfig(
  type: string
): { baseUrl: string; api: string; apiKeyEnv: string; models?: ProviderModelEntry[] } | undefined {
  return REGISTRY[type]?.providerConfig;
}

/**
 * All provider types that have env var mappings.
 * Used by GatewayManager to inject API keys as env vars.
 */
export function getKeyableProviderTypes(): string[] {
  return Object.entries(REGISTRY)
    .filter(([, meta]) => meta.envVar)
    .map(([type]) => type);
}

/** Get the curated model list for a provider type (used as fallback when API listing fails) */
export function getCuratedModels(type: string): string[] | undefined {
  return REGISTRY[type]?.curatedModels;
}
