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
  /** OpenClaw models.providers config (omit for built-in providers like anthropic) */
  providerConfig?: {
    baseUrl: string;
    api: string;
    apiKeyEnv: string;
    models?: ProviderModelEntry[];
  };
  /** Curated list of popular model IDs to show when API /models listing fails or is unavailable */
  curatedModels?: string[];
  /**
   * The provider name OpenClaw expects in openclaw.json.
   * When set, writing to openclaw.json will use this name instead of the internal type.
   * Example: internal type 'aliyun-coding' maps to OpenClaw name 'bailian'.
   */
  openclawProviderName?: string;
}

const REGISTRY: Record<string, ProviderBackendMeta> = {
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
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
  },
  'qwen-portal': {
  },
  ollama: {
    providerConfig: {
      baseUrl: 'http://localhost:11434/v1',
      api: 'openai-completions',
      apiKeyEnv: 'OLLAMA_API_KEY',
    },
    curatedModels: [],  // Ollama models are always dynamic (local), no curated list
  },
  custom: {
    envVar: 'CUSTOM_API_KEY',
    curatedModels: [],  // Custom providers have no curated list
  },
  // --- Coding Plan Providers ---
  'volcengine-coding': {
    envVar: 'VOLCENGINE_API_KEY',
    openclawProviderName: 'volcengine-plan',
    providerConfig: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      api: 'openai-completions',
      apiKeyEnv: 'VOLCENGINE_API_KEY',
      models: [
        { id: 'ark-code-latest', name: 'Ark Coding Plan' },
        { id: 'doubao-seed-code', name: 'Doubao Seed Code' },
        { id: 'glm-4.7', name: 'GLM 4.7 Coding' },
        { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking' },
        { id: 'kimi-k2.5', name: 'Kimi K2.5 Coding' },
        { id: 'doubao-seed-code-preview-251028', name: 'Doubao Seed Code Preview' },
      ],
    },
    curatedModels: ['ark-code-latest', 'doubao-seed-code', 'glm-4.7', 'kimi-k2-thinking', 'kimi-k2.5', 'doubao-seed-code-preview-251028'],
  },
  'aliyun-coding': {
    envVar: 'ALIYUN_CODING_API_KEY',
    openclawProviderName: 'bailian',
    providerConfig: {
      baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
      api: 'openai-completions',
      apiKeyEnv: 'ALIYUN_CODING_API_KEY',
      models: [
        { id: 'qwen3.5-plus', name: 'qwen3.5-plus' },
        { id: 'qwen3-max-2026-01-23', name: 'qwen3-max-2026-01-23' },
        { id: 'qwen3-coder-next', name: 'qwen3-coder-next' },
        { id: 'qwen3-coder-plus', name: 'qwen3-coder-plus' },
        { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
        { id: 'glm-5', name: 'glm-5' },
        { id: 'glm-4.7', name: 'glm-4.7' },
        { id: 'kimi-k2.5', name: 'kimi-k2.5' },
      ],
    },
    curatedModels: ['qwen3.5-plus', 'qwen3-coder-next', 'qwen3-coder-plus', 'qwen3-max-2026-01-23', 'MiniMax-M2.5', 'glm-5', 'glm-4.7', 'kimi-k2.5'],
  },
  'zhipu-coding': {
    envVar: 'ZHIPU_API_KEY',
    openclawProviderName: 'zhipu',
    providerConfig: {
      baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
      api: 'openai-completions',
      apiKeyEnv: 'ZHIPU_API_KEY',
      models: [
        { id: 'glm-5', name: 'GLM-5' },
        { id: 'glm-4.7', name: 'GLM-4.7' },
        { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
      ],
    },
    curatedModels: ['glm-5', 'glm-4.7', 'glm-4.5-air'],
  },
  'kimi-coding': {
    envVar: 'KIMI_API_KEY',
    openclawProviderName: 'kimi-coding',
    providerConfig: {
      baseUrl: 'https://api.kimi.com/coding/',
      api: 'anthropic-messages',
      apiKeyEnv: 'KIMI_API_KEY',
    },
    curatedModels: [
      'k2p5',
      'kimi-k2.5',
      'kimi-k2-thinking',
      'kimi-v1-a3b',
      'kimi-latest',
    ],
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

/**
 * Get the OpenClaw-facing provider name for a provider type.
 * Some internal types (e.g. 'aliyun-coding') need to be registered under
 * a different name in openclaw.json (e.g. 'bailian') per official docs.
 * Returns the mapped name, or the original type if no mapping exists.
 */
export function getProviderOpenClawName(type: string): string {
  return REGISTRY[type]?.openclawProviderName || type;
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
