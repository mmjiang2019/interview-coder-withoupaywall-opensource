import { AIProvider } from '../clients/AIClientFactory';
import { modelConfigManager } from '../config/ModelConfigManager';
import { providerDefaultsMap } from '../config/ModelDefaults';

// 模型能力配置 - 按供应商定义
const providerCapabilities: Record<AIProvider, string[]> = {
  openai: ['text', 'image', 'multimodal', 'code', 'reasoning', 'debugging'],
  anthropic: ['text', 'image', 'multimodal', 'code', 'reasoning', 'debugging'],
  gemini: ['text', 'image', 'multimodal', 'code', 'reasoning', 'debugging'],
  ollama: ['text', 'code'],
  bytedance: ['text', 'image', 'multimodal', 'code', 'reasoning', 'debugging'],
  zhipu: ['text', 'multimodal', 'code', 'reasoning', 'debugging']
};

// 模型上下文窗口配置 - 按供应商定义
const providerContextWindows: Record<AIProvider, number> = {
  openai: 128000,
  anthropic: 200000,
  gemini: 1000000,
  ollama: 8192,
  bytedance: 128000,
  zhipu: 128000
};

// 模型元数据接口
export interface ModelMetadata {
  id: string; // 模型唯一标识
  name: string; // 模型名称
  provider: AIProvider; // 模型提供者
  type: 'extraction' | 'solution' | 'debugging'; // 模型类型
  description: string; // 模型描述
  capabilities: string[]; // 模型能力
  version: string; // 模型版本
  isAvailable: boolean; // 模型是否可用
  lastChecked: Date; // 最后检查时间
  contextWindow?: number; // 上下文窗口大小
  maxTokens?: number; // 最大 token 数
  costPerToken?: number; // 每 token 成本
}

// 模型管理类
export class ModelManager {
  private static instance: ModelManager;
  private modelMetadata: Map<string, ModelMetadata> = new Map();
  private providerModels: Map<AIProvider, string[]> = new Map();

  private constructor() {
    // 初始化默认模型元数据
    this.initializeDefaultModels();
    
    // 监听配置变更，更新模型列表
    modelConfigManager.onConfigChange(() => {
      this.updateModelsForCurrentProvider();
    });
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * 初始化默认模型元数据
   * 从集中式配置生成模型元数据
   */
  private initializeDefaultModels(): void {
    // 为每个供应商和模型类型生成元数据
    const providers: AIProvider[] = ['openai', 'anthropic', 'gemini', 'ollama', 'bytedance', 'zhipu'];
    const types: ('extraction' | 'solution' | 'debugging')[] = ['extraction', 'solution', 'debugging'];
    
    providers.forEach(provider => {
      const defaultModels = providerDefaultsMap[provider];
      const capabilities = providerCapabilities[provider];
      const contextWindow = providerContextWindows[provider];
      
      types.forEach(type => {
        const modelId = defaultModels[type];
        const metadataId = `${provider}-${modelId}-${type}`;
        
        const modelMetadata: ModelMetadata = {
          id: metadataId,
          name: modelId,
          provider: provider,
          type: type,
          description: this.getModelDescription(provider, type, modelId),
          capabilities: capabilities,
          version: '1.0',
          isAvailable: true,
          lastChecked: new Date(),
          contextWindow: contextWindow,
          maxTokens: 4096
        };
        
        this.modelMetadata.set(metadataId, modelMetadata);
        
        // 更新提供者模型映射
        if (!this.providerModels.has(provider)) {
          this.providerModels.set(provider, []);
        }
        this.providerModels.get(provider)?.push(metadataId);
      });
    });
    
    console.log(`[ModelManager] Initialized ${this.modelMetadata.size} model metadata entries`);
  }
  
  /**
   * 获取模型描述
   */
  private getModelDescription(provider: AIProvider, type: string, modelId: string): string {
    const descriptions: Record<string, Record<string, string>> = {
      extraction: {
        openai: 'OpenAI 最先进的多模态模型，支持文本和图像输入',
        anthropic: 'Anthropic 最先进的模型，支持文本和图像输入',
        gemini: 'Google 的 Gemini 模型，支持多模态输入',
        ollama: 'Ollama 本地运行的模型',
        bytedance: 'ByteDance 的模型，支持多模态输入',
        zhipu: '智谱 AI 的 GLM 模型，支持多模态输入'
      },
      solution: {
        openai: 'OpenAI 模型，用于生成代码解决方案',
        anthropic: 'Anthropic 模型，用于生成代码解决方案',
        gemini: 'Google Gemini 模型，用于生成代码解决方案',
        ollama: 'Ollama 本地模型，用于生成代码解决方案',
        bytedance: 'ByteDance 模型，用于生成代码解决方案',
        zhipu: '智谱 AI GLM 模型，用于生成代码解决方案'
      },
      debugging: {
        openai: 'OpenAI 模型，用于代码调试',
        anthropic: 'Anthropic 模型，用于代码调试',
        gemini: 'Google Gemini 模型，用于代码调试',
        ollama: 'Ollama 本地模型，用于代码调试',
        bytedance: 'ByteDance 模型，用于代码调试',
        zhipu: '智谱 AI GLM 模型，用于代码调试'
      }
    };
    
    return descriptions[type]?.[provider] || `${provider} 模型`;
  }

  /**
   * 获取模型元数据
   */
  public getModelMetadata(modelId: string): ModelMetadata | undefined {
    return this.modelMetadata.get(modelId);
  }

  /**
   * 获取指定提供者的所有模型
   */
  public getModelsByProvider(provider: AIProvider): ModelMetadata[] {
    const modelIds = this.providerModels.get(provider) || [];
    return modelIds.map(id => this.modelMetadata.get(id)).filter((model): model is ModelMetadata => model !== undefined);
  }

  /**
   * 获取指定类型的模型
   */
  public getModelsByType(type: 'extraction' | 'solution' | 'debugging'): ModelMetadata[] {
    return Array.from(this.modelMetadata.values()).filter(model => model.type === type);
  }

  /**
   * 获取当前提供者的模型
   */
  public getCurrentProviderModels(): ModelMetadata[] {
    const config = modelConfigManager.getConfig();
    return this.getModelsByProvider(config.apiProvider);
  }

  /**
   * 获取推荐模型
   */
  public getRecommendedModel(type: 'extraction' | 'solution' | 'debugging'): ModelMetadata | undefined {
    const config = modelConfigManager.getConfig();
    const providerModels = this.getModelsByProvider(config.apiProvider);
    return providerModels.find(model => model.type === type);
  }

  /**
   * 检查模型可用性
   */
  public async checkModelAvailability(modelId: string): Promise<boolean> {
    const model = this.modelMetadata.get(modelId);
    if (!model) {
      return false;
    }

    // 这里可以添加实际的可用性检查逻辑
    // 例如，调用 API 检查模型是否存在和可用
    
    // 模拟检查
    model.isAvailable = true;
    model.lastChecked = new Date();
    this.modelMetadata.set(modelId, model);
    
    return model.isAvailable;
  }

  /**
   * 批量检查模型可用性
   */
  public async checkModelsAvailability(modelIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const modelId of modelIds) {
      const isAvailable = await this.checkModelAvailability(modelId);
      results.set(modelId, isAvailable);
    }
    
    return results;
  }

  /**
   * 添加自定义模型
   */
  public addCustomModel(model: ModelMetadata): void {
    this.modelMetadata.set(model.id, model);
    
    // 更新提供者模型映射
    if (!this.providerModels.has(model.provider)) {
      this.providerModels.set(model.provider, []);
    }
    this.providerModels.get(model.provider)?.push(model.id);
  }

  /**
   * 更新模型元数据
   */
  public updateModelMetadata(modelId: string, updates: Partial<ModelMetadata>): void {
    const existingModel = this.modelMetadata.get(modelId);
    if (existingModel) {
      const updatedModel = { ...existingModel, ...updates };
      this.modelMetadata.set(modelId, updatedModel);
    }
  }

  /**
   * 删除模型
   */
  public removeModel(modelId: string): void {
    const model = this.modelMetadata.get(modelId);
    if (model) {
      this.modelMetadata.delete(modelId);
      
      // 更新提供者模型映射
      const providerModels = this.providerModels.get(model.provider);
      if (providerModels) {
        const updatedModels = providerModels.filter(id => id !== modelId);
        if (updatedModels.length > 0) {
          this.providerModels.set(model.provider, updatedModels);
        } else {
          this.providerModels.delete(model.provider);
        }
      }
    }
  }

  /**
   * 更新当前提供者的模型列表
   */
  private updateModelsForCurrentProvider(): void {
    const config = modelConfigManager.getConfig();
    const provider = config.apiProvider;
    
    // 检查提供者是否变化
    if (this.currentProvider === provider) {
      console.log(`[ModelManager] Provider unchanged: ${provider}, skipping model update`);
      return;
    }
    
    // 更新当前提供者
    this.currentProvider = provider;
    
    // 这里可以添加逻辑，根据当前提供者动态获取可用模型
    // 例如，调用 API 获取提供者的模型列表
    
    console.log(`[ModelManager] Updated models for provider: ${provider}`);
  }
  
  // 跟踪当前提供者
  private currentProvider: AIProvider | null = null;

  /**
   * 导出模型配置
   */
  public exportModelConfig(): Record<string, ModelMetadata> {
    const config: Record<string, ModelMetadata> = {};
    this.modelMetadata.forEach((model, id) => {
      config[id] = model;
    });
    return config;
  }

  /**
   * 导入模型配置
   */
  public importModelConfig(config: Record<string, ModelMetadata>): void {
    // 清除现有模型
    this.modelMetadata.clear();
    this.providerModels.clear();
    
    // 导入新模型
    Object.entries(config).forEach(([id, model]) => {
      this.modelMetadata.set(id, model);
      
      // 更新提供者模型映射
      if (!this.providerModels.has(model.provider)) {
        this.providerModels.set(model.provider, []);
      }
      this.providerModels.get(model.provider)?.push(id);
    });
  }

  /**
   * 获取模型能力
   */
  public getModelCapabilities(modelId: string): string[] {
    const model = this.modelMetadata.get(modelId);
    return model?.capabilities || [];
  }

  /**
   * 检查模型是否支持特定能力
   */
  public modelSupportsCapability(modelId: string, capability: string): boolean {
    const capabilities = this.getModelCapabilities(modelId);
    return capabilities.includes(capability);
  }
  
  /**
   * 获取供应商的默认模型
   */
  public getDefaultModelForProvider(provider: AIProvider, type: 'extraction' | 'solution' | 'debugging'): string {
    return providerDefaultsMap[provider][type];
  }
  
  /**
   * 获取供应商的能力列表
   */
  public getProviderCapabilities(provider: AIProvider): string[] {
    return providerCapabilities[provider];
  }
  
  /**
   * 获取供应商的上下文窗口大小
   */
  public getProviderContextWindow(provider: AIProvider): number {
    return providerContextWindows[provider];
  }
}

export const modelManager = ModelManager.getInstance();
