import { AIClient, AIClientConfig } from "./AIClient";
import { OpenAIClient } from "./OpenAIClient";
import { AnthropicClient } from "./AnthropicClient";
import { modelConfigManager } from '../config/ModelConfigManager';
import { safeLogger } from '../SafeLogger';

export type AIProvider = "openai" | "anthropic" | "gemini" | "ollama" | "bytedance" | "zhipu";

export class AIClientFactory {
  private static instance: AIClientFactory;
  private clients: Map<AIProvider, AIClient> = new Map();
  private clientConfigs: Map<AIProvider, AIClientConfig> = new Map();

  private constructor() {
    safeLogger.mainLog("[AIClientFactory] Initializing AIClientFactory singleton");
    // 监听配置变更，自动更新客户端
    modelConfigManager.onConfigChange((config) => {
      safeLogger.mainLog("[AIClientFactory] Received config change event");
      // 获取当前提供者的配置
    const currentProviderConfig = config.providerConfigs[config.apiProvider] || {
      apiKey: '',
      extraction: '',
      solution: '',
      debugging: ''
    };
    safeLogger.mainLog("[AIClientFactory] New config:", {
      apiProvider: config.apiProvider,
      extractionModel: currentProviderConfig.extraction,
      solutionModel: currentProviderConfig.solution,
      debuggingModel: currentProviderConfig.debugging,
      language: config.language
    });
      const previousProvider = this.currentDefaultProvider;
      const newProvider = config.apiProvider;
      
      // 只有当提供者发生变化时才重置所有客户端并初始化
      if (previousProvider !== newProvider) {
        safeLogger.mainLog(`[AIClientFactory] Provider changed from ${previousProvider} to ${newProvider}, resetting clients`);
        this.resetAllClients();
        // 自动初始化默认模型的客户端
        safeLogger.mainLog("[AIClientFactory] Initializing default client for new provider:", newProvider);
        this.initializeDefaultClient(config);
      } else {
        safeLogger.mainLog(`[AIClientFactory] Provider unchanged: ${newProvider}`);
        // 检查客户端是否存在，如果不存在则初始化
        if (!this.hasClient(newProvider)) {
          safeLogger.mainLog(`[AIClientFactory] Client for ${newProvider} does not exist, initializing`);
          this.initializeDefaultClient(config);
        } else {
          safeLogger.mainLog(`[AIClientFactory] Client for ${newProvider} already exists, skipping initialization`);
        }
      }
    });
    
    // 初始化默认模型的客户端
    safeLogger.mainLog("[AIClientFactory] Initializing default client on startup");
    const config = modelConfigManager.getConfig();
    this.initializeDefaultClient(config);
    safeLogger.mainLog("[AIClientFactory] AIClientFactory initialization completed");
  }
  
  // 跟踪当前默认提供者
  private currentDefaultProvider: AIProvider | null = null;

  private initializeDefaultClient(config: any): void {
    try {
      const defaultProvider = config.apiProvider;
      safeLogger.mainLog(`[AIClientFactory] Initializing default client for provider: ${defaultProvider}`);
      if (defaultProvider) {
        // 更新当前默认提供者
        safeLogger.mainLog(`[AIClientFactory] Updating current default provider to: ${defaultProvider}`);
        this.currentDefaultProvider = defaultProvider;
        
        // 只有当客户端不存在时才初始化
        if (!this.hasClient(defaultProvider)) {
          safeLogger.mainLog(`[AIClientFactory] Client for ${defaultProvider} does not exist, creating and initializing`);
          this.getClient(defaultProvider);
          safeLogger.mainLog(`[AIClientFactory] ${defaultProvider} client initialized successfully`);
        } else {
          safeLogger.mainLog(`[AIClientFactory] Client for ${defaultProvider} already exists, skipping initialization`);
        }
      } else {
        safeLogger.mainLog("[AIClientFactory] No default provider specified in config");
      }
    } catch (error) {
      safeLogger.mainError("[AIClientFactory] Failed to initialize default client:", error);
    }
  }

  public static getInstance(): AIClientFactory {
    if (!AIClientFactory.instance) {
      AIClientFactory.instance = new AIClientFactory();
    }
    return AIClientFactory.instance;
  }

  public getClient(provider: AIProvider): AIClient {
    safeLogger.mainLog(`[AIClientFactory] Getting client for provider: ${provider}`);
    const client = this.clients.get(provider);
    if (!client) {
      safeLogger.mainLog(`[AIClientFactory] Client not found for ${provider}, creating new client`);
      const newClient = this.createClient(provider);
      safeLogger.mainLog(`[AIClientFactory] Created new client for ${provider}`);
      this.clients.set(provider, newClient);
      // 从配置管理器获取配置并初始化
      safeLogger.mainLog(`[AIClientFactory] Initializing client from config for ${provider}`);
      this.initializeClientFromConfig(provider, newClient);
      safeLogger.mainLog(`[AIClientFactory] Client initialization completed for ${provider}`);
      return newClient;
    } else {
      safeLogger.mainLog(`[AIClientFactory] Client found for ${provider}, returning existing instance`);
      return client;
    }
  }

  private createClient(provider: AIProvider): AIClient {
    switch (provider) {
      case "openai":
        return new OpenAIClient();
      case "anthropic":
        return new AnthropicClient();
      case "gemini":
        // For Gemini, we can use a similar approach to OpenAI
        return new OpenAIClient();
      case "ollama":
        // For Ollama, we can use a similar approach to OpenAI with different baseURL
        return new OpenAIClient();
      case "bytedance":
        // For ByteDance, we can use a similar approach to OpenAI with different baseURL
        return new OpenAIClient();
      case "zhipu":
        // For Zhipu, we can use a similar approach to OpenAI with different baseURL
        return new OpenAIClient();
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  private initializeClientFromConfig(provider: AIProvider, client: AIClient): void {
    const config = modelConfigManager.getConfig();
    const apiKey = config.apiKeys[provider];
    
    if (!apiKey) {
      safeLogger.warn(`No API key found for ${provider}`);
      return;
    }

    const clientConfig: AIClientConfig = {
      apiKey,
      baseURL: this.getBaseURLForProvider(provider),
      timeout: config.timeout,
      maxRetries: config.maxRetries
    };

    try {
      client.initialize(clientConfig);
      this.clientConfigs.set(provider, clientConfig);
    } catch (error) {
      safeLogger.mainError(`Failed to initialize client for ${provider}:`, error);
    }
  }

  private getBaseURLForProvider(provider: AIProvider): string {
    switch (provider) {
      case "openai":
        return "https://api.openai.com/v1";
      case "anthropic":
        return "https://api.anthropic.com/v1";
      case "gemini":
        return "https://generativelanguage.googleapis.com/v1";
      case "ollama":
        return "http://localhost:11434/api";
      case "bytedance":
        return "https://ark.cn-beijing.volces.com/api/v3";
      case "zhipu":
        return "https://open.bigmodel.cn/api/paas/v4";
      default:
        return "https://api.openai.com/v1";
    }
  }

  public initializeClient(provider: AIProvider, config: AIClientConfig): void {
    try {
      const client = this.getClient(provider);
      client.initialize(config);
      // Save the config for future use
      this.clientConfigs.set(provider, config);
      
      // Also update the global config
      modelConfigManager.setApiKey(provider, config.apiKey);
    } catch (error) {
      safeLogger.mainError(`Failed to initialize client for ${provider}:`, error);
      throw error;
    }
  }

  public resetClient(provider: AIProvider): void {
    const client = this.clients.get(provider);
    if (client) {
      try {
        client.reset();
      } catch (error) {
        safeLogger.mainError(`Error resetting client for ${provider}:`, error);
      }
      this.clients.delete(provider);
      this.clientConfigs.delete(provider);
    }
  }

  public resetAllClients(): void {
    this.clients.forEach((client, provider) => {
      try {
        client.reset();
      } catch (error) {
        safeLogger.mainError(`Error resetting client for ${provider}:`, error);
      }
    });
    this.clients.clear();
    this.clientConfigs.clear();
  }

  public getClientConfig(provider: AIProvider): AIClientConfig | undefined {
    return this.clientConfigs.get(provider);
  }

  public hasClient(provider: AIProvider): boolean {
    return this.clients.has(provider);
  }

  public getInitializedProviders(): AIProvider[] {
    return Array.from(this.clients.keys());
  }

  // 健康检查
  public async healthCheck(provider: AIProvider): Promise<{ healthy: boolean; error?: string }> {
    try {
      const client = this.getClient(provider);
      // 这里可以添加具体的健康检查逻辑
      // 例如发送一个简单的请求来验证客户端是否正常工作
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const aiClientFactory = AIClientFactory.getInstance();
