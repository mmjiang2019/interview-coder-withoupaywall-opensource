/**
 * 集中式模型配置文件
 * 统一管理所有模型供应商、模型列表和默认配置
 */

// 模型供应商类型
export type APIProvider = "openai" | "anthropic" | "gemini" | "ollama" | "bytedance" | "zhipu";

// 模型类别类型
export type ModelCategoryType = "extraction" | "solution" | "debugging";

// 模型基础信息接口
export interface AIModel {
  id: string;
  name: string;
  description: string;
}

// 模型元数据接口（扩展信息）
export interface ModelMetadata extends AIModel {
  provider: APIProvider;
  type: ModelCategoryType;
  capabilities: string[];
  version?: string;
  contextWindow?: number;
  maxTokens?: number;
  costPerToken?: number;
}

// 供应商模型列表映射
export type ProviderModelsMap = Record<APIProvider, AIModel[]>;

// 供应商默认模型配置
export interface ProviderDefaultModels {
  extraction: string;
  solution: string;
  debugging: string;
}

export type ProviderDefaultsMap = Record<APIProvider, ProviderDefaultModels>;

// 模型类别配置
export interface ModelCategory {
  key: ModelCategoryType;
  title: string;
  description: string;
}

// ==================== 模型类别定义 ====================

export const modelCategories: ModelCategory[] = [
  {
    key: "extraction",
    title: "Problem Extraction",
    description: "Model used to analyze screenshots and extract problem details"
  },
  {
    key: "solution",
    title: "Solution Generation",
    description: "Model used to generate coding solutions"
  },
  {
    key: "debugging",
    title: "Debugging",
    description: "Model used to debug and improve solutions"
  }
];

// ==================== OpenAI 模型 ====================

export const openaiModels: AIModel[] = [
  {
    id: "gpt-4o",
    name: "gpt-4o",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "gpt-4o-mini",
    name: "gpt-4o-mini",
    description: "Faster, more cost-effective option"
  }
];

// ==================== Anthropic 模型 ====================

export const anthropicModels: AIModel[] = [
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Balanced performance and speed"
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    description: "Top-level intelligence, fluency, and understanding"
  }
];

// ==================== Gemini 模型 ====================

export const geminiModels: AIModel[] = [
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Faster, more cost-effective option"
  }
];

// ==================== Ollama 模型 ====================

export const ollamaModels: AIModel[] = [
  {
    id: "qwen2.5-coder:3b",
    name: "qwen2.5-coder:3b",
    description: "Strong overall performance for coding tasks"
  },
  {
    id: "qwen3:1.7b",
    name: "qwen3:1.7b",
    description: "Faster, more cost-effective option"
  },
  {
    id: "qwen2.5-it:3b",
    name: "qwen2.5-it:3b",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "gemma3:4b",
    name: "gemma3:4b",
    description: "Best overall performance for problem extraction"
  }
];

// ==================== Bytedance 模型 ====================

export const bytedanceModels: AIModel[] = [
  {
    id: "doubao-seed-1-6-flash-250615",
    name: "doubao-seed-1-6-flash-250615",
    description: "Strong overall performance for coding tasks"
  },
  {
    id: "doubao-seed-1-6-250615",
    name: "doubao-seed-1-6-250615",
    description: "Faster, more cost-effective option"
  },
  {
    id: "deepseek-v3-250324",
    name: "deepseek-v3-250324",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "kimi-k2-250711",
    name: "kimi-k2-250711",
    description: "Best overall performance for problem extraction"
  },
  {
    id: "doubao-1-5-thinking-vision-pro-250428",
    name: "doubao-1-5-thinking-vision-pro-250428",
    description: "Best overall performance for problem extraction"
  }
];

// ==================== Zhipu 模型 ====================

export const zhipuModels: AIModel[] = [
  {
    id: "glm-5",
    name: "GLM-5",
    description: "Latest GLM model with enhanced capabilities"
  },
  {
    id: "glm-4-flash",
    name: "GLM-4 Flash",
    description: "Fast and efficient for most tasks"
  },
  {
    id: "glm-3-turbo",
    name: "GLM-3 Turbo",
    description: "Balanced performance and speed"
  }
];

// ==================== 供应商模型映射 ====================

export const providerModelsMap: ProviderModelsMap = {
  openai: openaiModels,
  anthropic: anthropicModels,
  gemini: geminiModels,
  ollama: ollamaModels,
  bytedance: bytedanceModels,
  zhipu: zhipuModels
};

// ==================== 默认模型配置 ====================

export const providerDefaultsMap: ProviderDefaultsMap = {
  openai: {
    extraction: "gpt-4o",
    solution: "gpt-4o",
    debugging: "gpt-4o"
  },
  anthropic: {
    extraction: "claude-3-7-sonnet-20250219",
    solution: "claude-3-7-sonnet-20250219",
    debugging: "claude-3-7-sonnet-20250219"
  },
  gemini: {
    extraction: "gemini-1.5-pro",
    solution: "gemini-1.5-pro",
    debugging: "gemini-1.5-pro"
  },
  ollama: {
    extraction: "qwen2.5-it:3b",
    solution: "qwen2.5-it:3b",
    debugging: "qwen2.5-it:3b"
  },
  bytedance: {
    extraction: "doubao-seed-1-6-flash-250615",
    solution: "doubao-seed-1-6-flash-250615",
    debugging: "doubao-seed-1-6-flash-250615"
  },
  zhipu: {
    extraction: "glm-5",
    solution: "glm-5",
    debugging: "glm-5"
  }
};

// ==================== 供应商信息 ====================

export interface ProviderInfo {
  id: APIProvider;
  name: string;
  description: string;
  apiKeyPlaceholder: string;
  apiKeyPattern?: string;
  docsUrl: string;
  apiKeysUrl: string;
}

export const providers: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o models",
    apiKeyPlaceholder: "sk-...",
    apiKeyPattern: "^sk-[a-zA-Z0-9]{48}$",
    docsUrl: "https://platform.openai.com/signup",
    apiKeysUrl: "https://platform.openai.com/api-keys"
  },
  {
    id: "anthropic",
    name: "Claude",
    description: "Claude 3 models",
    apiKeyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/signup",
    apiKeysUrl: "https://console.anthropic.com/settings/keys"
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Gemini 1.5 models",
    apiKeyPlaceholder: "Enter your Gemini API key",
    docsUrl: "https://aistudio.google.com/",
    apiKeysUrl: "https://aistudio.google.com/app/apikey"
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Mixed models",
    apiKeyPlaceholder: "Enter your Ollama API key",
    docsUrl: "https://ollama.com",
    apiKeysUrl: "https://ollama.com"
  },
  {
    id: "bytedance",
    name: "Bytedance",
    description: "Mixed models",
    apiKeyPlaceholder: "Enter your Bytedance API key",
    docsUrl: "https://www.volcengine.com/product/ark",
    apiKeysUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
  },
  {
    id: "zhipu",
    name: "Zhipu",
    description: "GLM models",
    apiKeyPlaceholder: "Enter your Zhipu API key",
    docsUrl: "https://www.bigmodel.cn/",
    apiKeysUrl: "https://www.bigmodel.cn/usercenter/apikeys"
  }
];

// ==================== 工具函数 ====================

/**
 * 获取指定供应商的模型列表
 */
export function getModelsByProvider(provider: APIProvider): AIModel[] {
  return providerModelsMap[provider] || [];
}

/**
 * 获取指定供应商的默认模型配置
 */
export function getDefaultModelsByProvider(provider: APIProvider): ProviderDefaultModels {
  return providerDefaultsMap[provider] || providerDefaultsMap.openai;
}

/**
 * 获取指定供应商的默认模型（指定类别）
 */
export function getDefaultModel(provider: APIProvider, category: ModelCategoryType): string {
  const defaults = getDefaultModelsByProvider(provider);
  return defaults[category];
}

/**
 * 获取供应商信息
 */
export function getProviderInfo(provider: APIProvider): ProviderInfo | undefined {
  return providers.find(p => p.id === provider);
}

/**
 * 验证模型是否属于指定供应商
 */
export function isValidModelForProvider(modelId: string, provider: APIProvider): boolean {
  const models = getModelsByProvider(provider);
  return models.some(m => m.id === modelId);
}

/**
 * 获取所有供应商列表
 */
export function getAllProviders(): ProviderInfo[] {
  return [...providers];
}

/**
 * 获取所有模型类别
 */
export function getAllModelCategories(): ModelCategory[] {
  return [...modelCategories];
}

// ==================== 模型元数据（用于后端）====================

export const modelMetadata: ModelMetadata[] = [
  // OpenAI 模型
  ...openaiModels.map(m => ({
    ...m,
    provider: "openai" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text", "image", "multimodal"],
    contextWindow: 128000,
    maxTokens: 4096
  })),
  // Anthropic 模型
  ...anthropicModels.map(m => ({
    ...m,
    provider: "anthropic" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text", "image", "multimodal"],
    contextWindow: 200000,
    maxTokens: 4096
  })),
  // Gemini 模型
  ...geminiModels.map(m => ({
    ...m,
    provider: "gemini" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text", "image", "multimodal"],
    contextWindow: 1000000,
    maxTokens: 4096
  })),
  // Ollama 模型
  ...ollamaModels.map(m => ({
    ...m,
    provider: "ollama" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text"],
    contextWindow: 8192,
    maxTokens: 4096
  })),
  // Bytedance 模型
  ...bytedanceModels.map(m => ({
    ...m,
    provider: "bytedance" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text", "image", "multimodal"],
    contextWindow: 128000,
    maxTokens: 4096
  })),
  // Zhipu 模型
  ...zhipuModels.map(m => ({
    ...m,
    provider: "zhipu" as APIProvider,
    type: "extraction" as ModelCategoryType,
    capabilities: ["text", "multimodal"],
    contextWindow: 128000,
    maxTokens: 4096
  }))
];

// ==================== 自定义模型管理 ====================

// 自定义模型存储（内存中）
let customModels: AIModel[] = [];

/**
 * 添加自定义模型
 */
export function addCustomModel(model: AIModel): void {
  // 检查是否已存在
  const exists = customModels.some(m => m.id === model.id);
  if (exists) {
    throw new Error(`Model with id ${model.id} already exists`);
  }
  customModels.push(model);
}

/**
 * 移除自定义模型
 */
export function removeCustomModel(modelId: string): void {
  customModels = customModels.filter(m => m.id !== modelId);
}

/**
 * 获取所有自定义模型
 */
export function getCustomModels(): AIModel[] {
  return [...customModels];
}

/**
 * 获取包含自定义模型的完整模型列表
 */
export function getModelsByProviderWithCustom(provider: APIProvider): AIModel[] {
  const baseModels = getModelsByProvider(provider);
  const providerCustomModels = customModels.filter(m => 
    // 自定义模型ID格式: custom-{provider}-{modelId}
    m.id.startsWith(`custom-${provider}-`)
  );
  return [...baseModels, ...providerCustomModels];
}

/**
 * 设置自定义模型列表（用于从配置加载）
 */
export function setCustomModels(models: AIModel[]): void {
  customModels = [...models];
}

export default {
  providers,
  modelCategories,
  providerModelsMap,
  providerDefaultsMap,
  modelMetadata,
  getModelsByProvider,
  getDefaultModelsByProvider,
  getDefaultModel,
  getProviderInfo,
  isValidModelForProvider,
  getAllProviders,
  getAllModelCategories,
  addCustomModel,
  removeCustomModel,
  getCustomModels,
  getModelsByProviderWithCustom,
  setCustomModels
};
