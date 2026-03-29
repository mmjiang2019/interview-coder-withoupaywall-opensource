import { AIProvider } from '../clients/AIClientFactory';
import { providerDefaultsMap, getDefaultModelsByProvider } from '../../src/config/models';

// 自定义模型接口
export interface CustomModel {
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
}

// 自定义提供者接口
export interface CustomProvider {
  name: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  apiKeyPattern: string;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };
}

// 模型配置接口
export interface ModelConfig {
  apiProvider: AIProvider;
  providerConfigs: Record<AIProvider, {
    apiKey: string;
    extraction: string;
    solution: string;
    debugging: string;
  }>;
  language: string;
  languages: string[];
  timeout: number;
  maxRetries: number;
  customProviders: CustomProvider[];
  customModels: CustomModel[];
}

// 配置变更事件类型
type ConfigChangeHandler = (config: ModelConfig) => void;

export class ModelConfigManager {
  private static instance: ModelConfigManager;
  private config: ModelConfig;
  private changeHandlers: ConfigChangeHandler[] = [];
  private configPath: string;

  private constructor() {
    // 初始化默认配置
    this.config = this.getDefaultConfig();
    this.configPath = this.getConfigPath();
    this.loadConfig();
  }

  public static getInstance(): ModelConfigManager {
    if (!ModelConfigManager.instance) {
      ModelConfigManager.instance = new ModelConfigManager();
    }
    return ModelConfigManager.instance;
  }

  private getDefaultConfig(): ModelConfig {
    // 使用集中式默认配置
    const defaults = providerDefaultsMap;
    
    return {
      apiProvider: 'openai',
      providerConfigs: {
        openai: {
          apiKey: '',
          extraction: defaults.openai.extraction,
          solution: defaults.openai.solution,
          debugging: defaults.openai.debugging
        },
        anthropic: {
          apiKey: '',
          extraction: defaults.anthropic.extraction,
          solution: defaults.anthropic.solution,
          debugging: defaults.anthropic.debugging
        },
        gemini: {
          apiKey: '',
          extraction: defaults.gemini.extraction,
          solution: defaults.gemini.solution,
          debugging: defaults.gemini.debugging
        },
        ollama: {
          apiKey: '',
          extraction: defaults.ollama.extraction,
          solution: defaults.ollama.solution,
          debugging: defaults.ollama.debugging
        },
        bytedance: {
          apiKey: '',
          extraction: defaults.bytedance.extraction,
          solution: defaults.bytedance.solution,
          debugging: defaults.bytedance.debugging
        },
        zhipu: {
          apiKey: '',
          extraction: defaults.zhipu.extraction,
          solution: defaults.zhipu.solution,
          debugging: defaults.zhipu.debugging
        }
      },
      language: 'golang',
      languages: ['python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php'],
      timeout: 60000,
      maxRetries: 2,
      customProviders: [],
      customModels: []
    };
  }

  private getConfigPath(): string {
    const appDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                         `${process.env.HOME}/Library/Application Support` : 
                         `${process.env.HOME}/.config`);
    return `${appDataPath}/TraeAI/config.json`;
  }

  private loadConfig(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // 确保配置目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // 读取配置文件
      if (fs.existsSync(this.configPath)) {
        const savedConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        // 确保providerConfigs存在，如果不存在则使用默认值
        const defaultConfig = this.getDefaultConfig();
        savedConfig.providerConfigs = {
          ...defaultConfig.providerConfigs,
          ...savedConfig.providerConfigs
        };
        // 处理旧配置结构的迁移
        if (savedConfig.apiKeys && !savedConfig.providerConfigs) {
          savedConfig.providerConfigs = defaultConfig.providerConfigs;
          Object.entries(savedConfig.apiKeys).forEach(([provider, apiKey]) => {
            if (savedConfig.providerConfigs[provider as AIProvider]) {
              savedConfig.providerConfigs[provider as AIProvider].apiKey = apiKey;
            }
          });
        }
        if (savedConfig.providerModels && !savedConfig.providerConfigs) {
          Object.entries(savedConfig.providerModels).forEach(([provider, models]) => {
            if (savedConfig.providerConfigs[provider as AIProvider]) {
              const typedModels = models as { extraction: string; solution: string; debugging: string };
              savedConfig.providerConfigs[provider as AIProvider].extraction = typedModels.extraction;
              savedConfig.providerConfigs[provider as AIProvider].solution = typedModels.solution;
              savedConfig.providerConfigs[provider as AIProvider].debugging = typedModels.debugging;
            }
          });
        }
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // 使用默认配置
      this.config = this.getDefaultConfig();
    }
  }

  private saveConfig(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // 确保配置目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // 写入配置文件
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  public getConfig(): ModelConfig & {
    apiKey: string;
    extractionModel: string;
    solutionModel: string;
    debuggingModel: string;
    apiKeys: Record<AIProvider, string>;
  } {
    const config = { ...this.config };
    // 添加前端需要的字段
    const currentProviderConfig = config.providerConfigs[config.apiProvider];
    return {
      ...config,
      apiKey: currentProviderConfig.apiKey,
      extractionModel: currentProviderConfig.extraction,
      solutionModel: currentProviderConfig.solution,
      debuggingModel: currentProviderConfig.debugging,
      apiKeys: {
        openai: config.providerConfigs.openai.apiKey,
        anthropic: config.providerConfigs.anthropic.apiKey,
        gemini: config.providerConfigs.gemini.apiKey,
        ollama: config.providerConfigs.ollama.apiKey,
        bytedance: config.providerConfigs.bytedance.apiKey,
        zhipu: config.providerConfigs.zhipu.apiKey
      }
    };
  }

  public updateConfig(updates: Partial<ModelConfig> & {
    apiKey?: string;
    extractionModel?: string;
    solutionModel?: string;
    debuggingModel?: string;
    apiKeys?: Record<AIProvider, string>;
  }): void {
    // 检查是否有实际变更
    let hasChanges = false;
    const updatedConfig = { ...this.config };
    
    // 先处理apiProvider的更新，确保后续的模型设置更新使用正确的提供者
    if (updates.apiProvider !== undefined && updatedConfig.apiProvider !== updates.apiProvider) {
      updatedConfig.apiProvider = updates.apiProvider;
      hasChanges = true;
    }
    
    // 处理旧格式的更新
    if (updates.apiKey !== undefined) {
      const currentProviderConfig = { ...updatedConfig.providerConfigs[updatedConfig.apiProvider] };
      if (currentProviderConfig.apiKey !== updates.apiKey) {
        currentProviderConfig.apiKey = updates.apiKey;
        updatedConfig.providerConfigs[updatedConfig.apiProvider] = currentProviderConfig;
        hasChanges = true;
      }
    }
    
    if (updates.extractionModel !== undefined) {
      const currentProviderConfig = { ...updatedConfig.providerConfigs[updatedConfig.apiProvider] };
      if (currentProviderConfig.extraction !== updates.extractionModel) {
        currentProviderConfig.extraction = updates.extractionModel;
        updatedConfig.providerConfigs[updatedConfig.apiProvider] = currentProviderConfig;
        hasChanges = true;
      }
    }
    
    if (updates.solutionModel !== undefined) {
      const currentProviderConfig = { ...updatedConfig.providerConfigs[updatedConfig.apiProvider] };
      if (currentProviderConfig.solution !== updates.solutionModel) {
        currentProviderConfig.solution = updates.solutionModel;
        updatedConfig.providerConfigs[updatedConfig.apiProvider] = currentProviderConfig;
        hasChanges = true;
      }
    }
    
    if (updates.debuggingModel !== undefined) {
      const currentProviderConfig = { ...updatedConfig.providerConfigs[updatedConfig.apiProvider] };
      if (currentProviderConfig.debugging !== updates.debuggingModel) {
        currentProviderConfig.debugging = updates.debuggingModel;
        updatedConfig.providerConfigs[updatedConfig.apiProvider] = currentProviderConfig;
        hasChanges = true;
      }
    }
    
    if (updates.apiKeys !== undefined) {
      Object.entries(updates.apiKeys).forEach(([provider, apiKey]) => {
        const providerConfig = { ...updatedConfig.providerConfigs[provider as AIProvider] };
        if (providerConfig.apiKey !== apiKey) {
          providerConfig.apiKey = apiKey;
          updatedConfig.providerConfigs[provider as AIProvider] = providerConfig;
          hasChanges = true;
        }
      });
    }
    
    if (updates.providerConfigs !== undefined) {
      // 深度比较providerConfigs
      if (JSON.stringify(updatedConfig.providerConfigs) !== JSON.stringify(updates.providerConfigs)) {
        updatedConfig.providerConfigs = { ...updates.providerConfigs };
        hasChanges = true;
      }
    }
    
    if (updates.language !== undefined && updatedConfig.language !== updates.language) {
      updatedConfig.language = updates.language;
      hasChanges = true;
    }
    
    if (updates.languages !== undefined) {
      if (JSON.stringify(updatedConfig.languages) !== JSON.stringify(updates.languages)) {
        updatedConfig.languages = [...updates.languages];
        hasChanges = true;
      }
    }
    
    if (updates.timeout !== undefined && updatedConfig.timeout !== updates.timeout) {
      updatedConfig.timeout = updates.timeout;
      hasChanges = true;
    }
    
    if (updates.maxRetries !== undefined && updatedConfig.maxRetries !== updates.maxRetries) {
      updatedConfig.maxRetries = updates.maxRetries;
      hasChanges = true;
    }
    
    if (updates.customProviders !== undefined) {
      if (JSON.stringify(updatedConfig.customProviders) !== JSON.stringify(updates.customProviders)) {
        updatedConfig.customProviders = [...updates.customProviders];
        hasChanges = true;
      }
    }
    
    if (!hasChanges) {
      console.log(`[ModelConfigManager] No actual changes in config, skipping update`);
      return;
    }
    
    console.log(`[ModelConfigManager] Updating config with:`, updates);
    this.config = updatedConfig;
    console.log(`[ModelConfigManager] Config updated successfully`);
    this.saveConfig();
    console.log(`[ModelConfigManager] Config saved to file`);
    this.notifyChangeHandlers();
  }

  public setApiProvider(provider: AIProvider): void {
    this.updateConfig({
      apiProvider: provider
    });
  }

  public setApiKey(provider: AIProvider, apiKey: string): void {
    const providerConfigs = { ...this.config.providerConfigs };
    providerConfigs[provider] = {
      ...providerConfigs[provider],
      apiKey
    };
    this.updateConfig({ providerConfigs });
  }

  public setModel(type: 'extraction' | 'solution' | 'debugging', model: string): void {
    const providerConfigs = { ...this.config.providerConfigs };
    providerConfigs[this.config.apiProvider] = {
      ...providerConfigs[this.config.apiProvider],
      [type]: model
    };
    this.updateConfig({ providerConfigs });
  }

  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }

  public setTimeout(timeout: number): void {
    this.updateConfig({ timeout });
  }

  public setMaxRetries(maxRetries: number): void {
    this.updateConfig({ maxRetries });
  }

  // Language management
  public addLanguage(language: string): void {
    if (!this.config.languages.includes(language)) {
      const languages = [...this.config.languages, language];
      this.updateConfig({ languages });
    }
  }

  public removeLanguage(language: string): void {
    if (this.config.languages.includes(language) && language !== this.config.language) {
      const languages = this.config.languages.filter(l => l !== language);
      this.updateConfig({ languages });
    }
  }

  public getLanguages(): string[] {
    return [...this.config.languages];
  }

  // Custom provider management
  public addCustomProvider(provider: CustomProvider): void {
    const customProviders = [...this.config.customProviders, provider];
    this.updateConfig({ customProviders });
  }

  public removeCustomProvider(name: string): void {
    const customProviders = this.config.customProviders.filter(p => p.name !== name);
    this.updateConfig({ customProviders });
  }

  public getCustomProviders(): CustomProvider[] {
    return [...this.config.customProviders];
  }

  public getCustomProvider(name: string): CustomProvider | undefined {
    return this.config.customProviders.find(p => p.name === name);
  }

  // Custom model management
  public addCustomModel(model: CustomModel): void {
    const customModels = [...this.config.customModels, model];
    this.updateConfig({ customModels });
  }

  public removeCustomModel(modelId: string): void {
    const customModels = this.config.customModels.filter(m => m.id !== modelId);
    this.updateConfig({ customModels });
  }

  public getCustomModels(): CustomModel[] {
    return [...this.config.customModels];
  }

  public getCustomModelsByProvider(provider: AIProvider): CustomModel[] {
    return this.config.customModels.filter(m => m.provider === provider);
  }

  public onConfigChange(handler: ConfigChangeHandler): void {
    const handlerId = Math.random().toString(36).substr(2, 9);
    console.log(`[ModelConfigManager] Registering config change handler with ID: ${handlerId}`);
    // 为了调试，我们可以给handler添加一个id属性
    (handler as any)._handlerId = handlerId;
    this.changeHandlers.push(handler);
    console.log(`[ModelConfigManager] Total registered handlers: ${this.changeHandlers.length}`);
  }

  public offConfigChange(handler: ConfigChangeHandler): void {
    const handlerId = (handler as any)._handlerId || 'unknown';
    console.log(`[ModelConfigManager] Removing config change handler with ID: ${handlerId}`);
    this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
    console.log(`[ModelConfigManager] Total registered handlers after removal: ${this.changeHandlers.length}`);
  }

  private notifyChangeHandlers(): void {
    console.log(`[ModelConfigManager] Notifying ${this.changeHandlers.length} config change handlers`);
    this.changeHandlers.forEach((handler, index) => {
      const handlerId = (handler as any)._handlerId || `handler_${index}`;
      console.log(`[ModelConfigManager] Notifying handler ${handlerId} (${index + 1}/${this.changeHandlers.length})`);
      try {
        handler(this.getConfig());
        console.log(`[ModelConfigManager] Handler ${handlerId} notified successfully`);
      } catch (error) {
        console.error(`[ModelConfigManager] Error in config change handler ${handlerId}:`, error);
      }
    });
  }

  // 验证配置
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 验证 API 提供者
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'ollama', 'bytedance', 'zhipu'];
    if (!validProviders.includes(this.config.apiProvider)) {
      errors.push(`Invalid API provider: ${this.config.apiProvider}`);
    }
    
    // 验证 API 密钥
    const currentProviderConfig = this.config.providerConfigs[this.config.apiProvider];
    if (!currentProviderConfig.apiKey) {
      errors.push(`No API key set for ${this.config.apiProvider}`);
    }
    
    // 验证模型名称
    if (!currentProviderConfig.extraction) {
      errors.push('Extraction model is required');
    }
    if (!currentProviderConfig.solution) {
      errors.push('Solution model is required');
    }
    if (!currentProviderConfig.debugging) {
      errors.push('Debugging model is required');
    }
    
    // 验证语言
    if (!this.config.language) {
      errors.push('Language is required');
    }
    
    // 验证超时
    if (this.config.timeout <= 0) {
      errors.push('Timeout must be positive');
    }
    
    // 验证重试次数
    if (this.config.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const modelConfigManager = ModelConfigManager.getInstance();