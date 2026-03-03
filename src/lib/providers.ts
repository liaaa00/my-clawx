/**
 * Provider Types & UI Metadata — single source of truth for the frontend.
 *
 * NOTE: When adding a new provider type, also update
 * electron/utils/provider-registry.ts (env vars, models, configs).
 */

export const PROVIDER_TYPES = [
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
  'custom',
  // Coding Plan types
  'volcengine-coding',
  'aliyun-coding',
  'zhipu-coding',
  'kimi-coding',
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderWithKeyInfo extends ProviderConfig {
  hasKey: boolean;
  keyMasked: string | null;
}

export interface ProviderTypeInfo {
  id: ProviderType;
  name: string;
  icon: string;
  placeholder: string;
  /** Model brand name for display (e.g. "Claude", "GPT") */
  model?: string;
  requiresApiKey: boolean;
  /** Pre-filled base URL (for proxy/compatible providers like SiliconFlow) */
  defaultBaseUrl?: string;
  /** Whether the user can edit the base URL in setup */
  showBaseUrl?: boolean;
  /** Whether to show a Model ID input field (for providers where user picks the model) */
  showModelId?: boolean;
  /** Whether this provider uses OAuth device flow instead of an API key */
  isOAuth?: boolean;
  /** Whether this provider also accepts a direct API key (in addition to OAuth) */
  supportsApiKey?: boolean;
  /** Whether this is a Coding Plan provider (shown in dedicated section) */
  isCodingPlan?: boolean;
}

import { providerIcons } from '@/assets/providers';

/** All supported provider types with UI metadata */
export const PROVIDER_TYPE_INFO: ProviderTypeInfo[] = [
  // --- Standard Providers ---
  { id: 'anthropic', name: 'Anthropic', icon: '🤖', placeholder: 'sk-ant-api03-...', model: 'Claude', requiresApiKey: true, showModelId: true },
  { id: 'openai', name: 'OpenAI', icon: '💚', placeholder: 'sk-proj-...', model: 'GPT', requiresApiKey: true, showModelId: true },
  { id: 'google', name: 'Google', icon: '🔷', placeholder: 'AIza...', model: 'Gemini', requiresApiKey: true, showModelId: true },
  { id: 'openrouter', name: 'OpenRouter', icon: '🌐', placeholder: 'sk-or-v1-...', model: 'Multi-Model', requiresApiKey: true, showModelId: true },
  { id: 'moonshot', name: 'Moonshot (CN)', icon: '🌙', placeholder: 'sk-...', model: 'Kimi', requiresApiKey: true, defaultBaseUrl: 'https://api.moonshot.cn/v1', showBaseUrl: true, showModelId: true },
  { id: 'siliconflow', name: 'SiliconFlow (CN)', icon: '🌊', placeholder: 'sk-...', model: 'Multi-Model', requiresApiKey: true, defaultBaseUrl: 'https://api.siliconflow.cn/v1', showBaseUrl: true, showModelId: true },
  { id: 'aliyun', name: 'Alibaba Cloud (CN)', icon: '☁️', placeholder: 'sk-...', model: 'Qwen', requiresApiKey: true, defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', showBaseUrl: true, showModelId: true },
  { id: 'volcengine', name: 'Volcengine (CN)', icon: '🌋', placeholder: 'xxxx-xxxx-xxxx...', model: 'Doubao', requiresApiKey: true, defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', showBaseUrl: true, showModelId: true },
  { id: 'minimax-portal', name: 'MiniMax (CN)', icon: '☁️', placeholder: 'sk-...', model: 'MiniMax', requiresApiKey: false, isOAuth: true, supportsApiKey: true, showModelId: true },
  { id: 'qwen-portal', name: 'Qwen (CN)', icon: '☁️', placeholder: 'sk-...', model: 'Qwen', requiresApiKey: false, isOAuth: true, supportsApiKey: true, showModelId: true },
  { id: 'ollama', name: 'Ollama', icon: '🦙', placeholder: 'Not required', requiresApiKey: false, defaultBaseUrl: 'http://localhost:11434', showBaseUrl: true, showModelId: true },
  { id: 'custom', name: 'Custom', icon: '⚙️', placeholder: 'API key...', requiresApiKey: true, showBaseUrl: true, showModelId: true },

  // --- Coding Plan Providers (编程套餐) ---
  {
    id: 'volcengine-coding',
    name: '火山引擎 Coding Plan',
    icon: '🌋',
    placeholder: 'xxxx-xxxx-xxxx...',
    model: 'Doubao Code',
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    showBaseUrl: true,
    showModelId: true,
    isCodingPlan: true,
  },
  {
    id: 'aliyun-coding',
    name: '阿里云 Coding Plan',
    icon: '☁️',
    placeholder: 'sk-sp-...',
    model: 'Qwen Coder',
    requiresApiKey: true,
    defaultBaseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    showBaseUrl: true,
    showModelId: true,
    isCodingPlan: true,
  },
  {
    id: 'zhipu-coding',
    name: '智谱 AI Coding Plan',
    icon: '🧠',
    placeholder: 'xxxx.xxxx',
    model: 'GLM Coder',
    requiresApiKey: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    showBaseUrl: true,
    showModelId: true,
    isCodingPlan: true,
  },
  {
    id: 'kimi-coding',
    name: 'Kimi Coding Plan',
    icon: '🌙',
    placeholder: 'sk-...',
    model: 'Kimi Coder',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.kimi.com/coding/v1',
    showBaseUrl: true,
    showModelId: true,
    isCodingPlan: true,
  },
];

/** Standard (non-coding-plan) providers */
export const STANDARD_PROVIDERS = PROVIDER_TYPE_INFO.filter((p) => !p.isCodingPlan);

/** Coding Plan providers */
export const CODING_PLAN_PROVIDERS = PROVIDER_TYPE_INFO.filter((p) => p.isCodingPlan);

/** Get the SVG logo URL for a provider type, falls back to undefined */
export function getProviderIconUrl(type: ProviderType | string): string | undefined {
  return providerIcons[type];
}

/** Whether a provider's logo needs CSS invert in dark mode (all logos are monochrome) */
export function shouldInvertInDark(_type: ProviderType | string): boolean {
  return true;
}

/** Provider list shown in the Setup wizard */
export const SETUP_PROVIDERS = PROVIDER_TYPE_INFO;

/** Get type info by provider type id */
export function getProviderTypeInfo(type: ProviderType): ProviderTypeInfo | undefined {
  return PROVIDER_TYPE_INFO.find((t) => t.id === type);
}
