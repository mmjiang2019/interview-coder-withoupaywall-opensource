import { AIProvider } from '../clients/AIClientFactory';

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
  apiKeys: Record<AIProvider, string>;
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  timeout: number;
  maxRetries: number;
  customProviders: CustomProvider[];
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
    return {
      apiProvider: 'openai',
      apiKeys: {
        openai: '',
        anthropic: '',
        gemini: '',
        ollama: '',
        bytedance: ''
      },
      extractionModel: 'gpt-4o',
      solutionModel: 'gpt-4o',
      debuggingModel: 'gpt-4o',
      language: 'python',
      timeout: 60000,
      maxRetries: 2,
      customProviders: []
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

  public getConfig(): ModelConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<ModelConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.notifyChangeHandlers();
  }

  public setApiProvider(provider: AIProvider): void {
    this.updateConfig({ apiProvider: provider });
  }

  public setApiKey(provider: AIProvider, apiKey: string): void {
    const apiKeys = { ...this.config.apiKeys, [provider]: apiKey };
    this.updateConfig({ apiKeys });
  }

  public setModel(type: 'extraction' | 'solution' | 'debugging', model: string): void {
    switch (type) {
      case 'extraction':
        this.updateConfig({ extractionModel: model });
        break;
      case 'solution':
        this.updateConfig({ solutionModel: model });
        break;
      case 'debugging':
        this.updateConfig({ debuggingModel: model });
        break;
    }
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

  public onConfigChange(handler: ConfigChangeHandler): void {
    this.changeHandlers.push(handler);
  }

  public offConfigChange(handler: ConfigChangeHandler): void {
    this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
  }

  private notifyChangeHandlers(): void {
    this.changeHandlers.forEach(handler => {
      try {
        handler(this.getConfig());
      } catch (error) {
        console.error('Error in config change handler:', error);
      }
    });
  }

  // 验证配置
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 验证 API 提供者
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'ollama', 'bytedance'];
    if (!validProviders.includes(this.config.apiProvider)) {
      errors.push(`Invalid API provider: ${this.config.apiProvider}`);
    }
    
    // 验证 API 密钥
    const currentApiKey = this.config.apiKeys[this.config.apiProvider];
    if (!currentApiKey) {
      errors.push(`No API key set for ${this.config.apiProvider}`);
    }
    
    // 验证模型名称
    if (!this.config.extractionModel) {
      errors.push('Extraction model is required');
    }
    if (!this.config.solutionModel) {
      errors.push('Solution model is required');
    }
    if (!this.config.debuggingModel) {
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