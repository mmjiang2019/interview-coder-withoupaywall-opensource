import { AIClient, AIClientConfig } from "./AIClient";
import { OpenAIClient } from "./OpenAIClient";
import { AnthropicClient } from "./AnthropicClient";
import { modelConfigManager } from '../config/ModelConfigManager';

export type AIProvider = "openai" | "anthropic" | "gemini" | "ollama" | "bytedance";

export class AIClientFactory {
  private static instance: AIClientFactory;
  private clients: Map<AIProvider, AIClient> = new Map();
  private clientConfigs: Map<AIProvider, AIClientConfig> = new Map();

  private constructor() {
    // 监听配置变更，自动更新客户端
    modelConfigManager.onConfigChange(() => {
      this.resetAllClients();
    });
  }

  public static getInstance(): AIClientFactory {
    if (!AIClientFactory.instance) {
      AIClientFactory.instance = new AIClientFactory();
    }
    return AIClientFactory.instance;
  }

  public getClient(provider: AIProvider): AIClient {
    const client = this.clients.get(provider);
    if (!client) {
      const newClient = this.createClient(provider);
      this.clients.set(provider, newClient);
      // 从配置管理器获取配置并初始化
      this.initializeClientFromConfig(provider, newClient);
      return newClient;
    }
    return client;
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
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  private initializeClientFromConfig(provider: AIProvider, client: AIClient): void {
    const config = modelConfigManager.getConfig();
    const apiKey = config.apiKeys[provider];
    
    if (!apiKey) {
      console.warn(`No API key found for ${provider}`);
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
      console.error(`Failed to initialize client for ${provider}:`, error);
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
      console.error(`Failed to initialize client for ${provider}:`, error);
      throw error;
    }
  }

  public resetClient(provider: AIProvider): void {
    const client = this.clients.get(provider);
    if (client) {
      try {
        client.reset();
      } catch (error) {
        console.error(`Error resetting client for ${provider}:`, error);
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
        console.error(`Error resetting client for ${provider}:`, error);
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
