/**
 * 模型默认配置
 * 此文件与前端 src/config/models.ts 保持同步
 * 用于后端配置管理
 */

import { AIProvider } from '../clients/AIClientFactory';

export type ModelCategoryType = 'extraction' | 'solution' | 'debugging';

export interface ProviderDefaultModels {
  extraction: string;
  solution: string;
  debugging: string;
}

export type ProviderDefaultsMap = Record<AIProvider, ProviderDefaultModels>;

// 默认模型配置 - 与前端保持一致
export const providerDefaultsMap: ProviderDefaultsMap = {
  openai: {
    extraction: 'gpt-4o',
    solution: 'gpt-4o',
    debugging: 'gpt-4o'
  },
  anthropic: {
    extraction: 'claude-3-7-sonnet-20250219',
    solution: 'claude-3-7-sonnet-20250219',
    debugging: 'claude-3-7-sonnet-20250219'
  },
  gemini: {
    extraction: 'gemini-1.5-pro',
    solution: 'gemini-1.5-pro',
    debugging: 'gemini-1.5-pro'
  },
  ollama: {
    extraction: 'qwen2.5-it:3b',
    solution: 'qwen2.5-it:3b',
    debugging: 'qwen2.5-it:3b'
  },
  bytedance: {
    extraction: 'doubao-seed-1-6-flash-250615',
    solution: 'doubao-seed-1-6-flash-250615',
    debugging: 'doubao-seed-1-6-flash-250615'
  },
  zhipu: {
    extraction: 'glm-5',
    solution: 'glm-5',
    debugging: 'glm-5'
  }
};

/**
 * 获取指定供应商的默认模型配置
 */
export function getDefaultModelsByProvider(provider: AIProvider): ProviderDefaultModels {
  return providerDefaultsMap[provider] || providerDefaultsMap.openai;
}

/**
 * 获取指定供应商的默认模型（指定类别）
 */
export function getDefaultModel(provider: AIProvider, category: ModelCategoryType): string {
  const defaults = getDefaultModelsByProvider(provider);
  return defaults[category];
}

/**
 * 获取所有支持的供应商列表
 */
export function getSupportedProviders(): AIProvider[] {
  return ['openai', 'anthropic', 'gemini', 'ollama', 'bytedance', 'zhipu'];
}

export default {
  providerDefaultsMap,
  getDefaultModelsByProvider,
  getDefaultModel,
  getSupportedProviders
};
