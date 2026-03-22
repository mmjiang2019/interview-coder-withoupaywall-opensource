import { AIProvider } from '../clients/AIClientFactory';
import { modelConfigManager } from '../config/ModelConfigManager';

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
   */
  private initializeDefaultModels(): void {
    const defaultModels: ModelMetadata[] = [
      // OpenAI 模型
      {
        id: 'openai-gpt-4o',
        name: 'gpt-4o',
        provider: 'openai',
        type: 'extraction',
        description: 'OpenAI 最先进的多模态模型，支持文本和图像输入',
        capabilities: ['text', 'image', 'multimodal'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 128000,
        maxTokens: 4096
      },
      {
        id: 'openai-gpt-4o-solution',
        name: 'gpt-4o',
        provider: 'openai',
        type: 'solution',
        description: 'OpenAI 最先进的多模态模型，用于生成代码解决方案',
        capabilities: ['text', 'code', 'reasoning'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 128000,
        maxTokens: 4096
      },
      {
        id: 'openai-gpt-4o-debugging',
        name: 'gpt-4o',
        provider: 'openai',
        type: 'debugging',
        description: 'OpenAI 最先进的多模态模型，用于代码调试',
        capabilities: ['text', 'code', 'debugging'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 128000,
        maxTokens: 4096
      },
      
      // Anthropic 模型
      {
        id: 'anthropic-claude-3-opus',
        name: 'claude-3-opus-20240229',
        provider: 'anthropic',
        type: 'extraction',
        description: 'Anthropic 最先进的模型，支持文本和图像输入',
        capabilities: ['text', 'image', 'multimodal'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 200000,
        maxTokens: 4096
      },
      
      // Gemini 模型
      {
        id: 'gemini-1.5-pro',
        name: 'gemini-1.5-pro',
        provider: 'gemini',
        type: 'extraction',
        description: 'Google 的 Gemini 1.5 Pro 模型，支持多模态输入',
        capabilities: ['text', 'image', 'multimodal'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 1000000,
        maxTokens: 4096
      },
      
      // Ollama 模型
      {
        id: 'ollama-llama3',
        name: 'llama3',
        provider: 'ollama',
        type: 'extraction',
        description: 'Ollama 本地运行的 Llama 3 模型',
        capabilities: ['text'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 8192,
        maxTokens: 4096
      },
      
      // ByteDance 模型
      {
        id: 'bytedance-doubao',
        name: 'doubao',
        provider: 'bytedance',
        type: 'extraction',
        description: 'ByteDance 的 Doubao 模型，支持多模态输入',
        capabilities: ['text', 'image', 'multimodal'],
        version: '1.0',
        isAvailable: true,
        lastChecked: new Date(),
        contextWindow: 128000,
        maxTokens: 4096
      }
    ];

    // 添加默认模型到存储
    defaultModels.forEach(model => {
      this.modelMetadata.set(model.id, model);
      
      // 更新提供者模型映射
      if (!this.providerModels.has(model.provider)) {
        this.providerModels.set(model.provider, []);
      }
      this.providerModels.get(model.provider)?.push(model.id);
    });
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
}

export const modelManager = ModelManager.getInstance();