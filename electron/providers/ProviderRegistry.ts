// ProviderRegistry.ts - Registry for managing all AI providers

import { OpenAIProvider } from "./OpenAIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { AnthropicProvider } from "./AnthropicProvider";
import { OllamaProvider } from "./OllamaProvider";
import { ByteDanceProvider } from "./ByteDanceProvider";
import { AIProvider } from "./AIProvider";
import { configHelper } from "../ConfigHelper";

export interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  defaultApiKeyPrefix?: string;
  defaultModels?: {
    extraction?: string;
    solution?: string;
    debugging?: string;
  };
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, typeof AIProvider> = new Map();
  private providerInstances: Map<string, AIProvider> = new Map();
  private providerInfo: Map<string, ProviderInfo> = new Map();

  private constructor() {
    this.registerProviders();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register all available providers
   */
  private registerProviders(): void {
    // Register OpenAI
    this.registerProvider(
      "openai",
      OpenAIProvider,
      {
        name: "openai",
        displayName: "OpenAI",
        description: "GPT-4o models",
        icon: "🤖",
        defaultApiKeyPrefix: "sk-",
      }
    );

    // Register Gemini
    this.registerProvider(
      "gemini",
      GeminiProvider,
      {
        name: "gemini",
        displayName: "Google Gemini",
        description: "Gemini 1.5 models",
        icon: "✨",
        defaultApiKeyPrefix: "",
      }
    );

    // Register Anthropic
    this.registerProvider(
      "anthropic",
      AnthropicProvider,
      {
        name: "anthropic",
        displayName: "Anthropic Claude",
        description: "Claude 3 models",
        icon: "🧠",
        defaultApiKeyPrefix: "sk-ant-",
      }
    );

    // Register Ollama
    this.registerProvider(
      "ollama",
      OllamaProvider,
      {
        name: "ollama",
        displayName: "Ollama",
        description: "Local LLM models",
        icon: "🖥️",
        defaultApiKeyPrefix: "",
      }
    );

    // Register ByteDance
    this.registerProvider(
      "bytedance",
      ByteDanceProvider,
      {
        name: "bytedance",
        displayName: "ByteDance",
        description: "Doubao & DeepSeek models",
        icon: "🔥",
        defaultApiKeyPrefix: "",
      }
    );
  }

  /**
   * Register a provider
   */
  private registerProvider(
    name: string,
    ProviderClass: typeof AIProvider,
    info: ProviderInfo
  ): void {
    this.providers.set(name, ProviderClass);
    this.providerInfo.set(name, info);
  }

  /**
   * Get provider class by name
   */
  getProviderClass(providerName: string): typeof AIProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get all provider names
   */
  getAllProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider info by name
   */
  getProviderInfo(providerName: string): ProviderInfo | undefined {
    return this.providerInfo.get(providerName);
  }

  /**
   * Get all provider info
   */
  getAllProviderInfo(): ProviderInfo[] {
    return Array.from(this.providerInfo.values());
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(providerName: string): string[] {
    const providerInfo = this.providerInfo.get(providerName);
    if (providerInfo) {
      const config = configHelper.loadConfig();
      const models = config[`${providerName}Models`] || [];
      return models.length > 0 ? models : this.getDefaultModels(providerName);
    }
    return [];
  }

  /**
   * Get default models for a provider
   */
  getDefaultModels(providerName: string): string[] {
    const providerInfo = this.providerInfo.get(providerName);
    if (providerInfo && providerInfo.defaultModels) {
      return [
        providerInfo.defaultModels.extraction || "",
        providerInfo.defaultModels.solution || "",
        providerInfo.defaultModels.debugging || "",
      ].filter(Boolean);
    }
    return [];
  }

  /**
   * Create provider instance with current config
   */
  async createProvider(providerName: string): Promise<AIProvider> {
    const providerClass = this.getProviderClass(providerName);
    if (!providerClass) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const config = configHelper.loadConfig();

    // Get provider-specific config
    const providerConfig: any = {
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      baseURL: config.baseURL,
    };

    // Create provider instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new (providerClass as any)(providerConfig);

    // Initialize provider
    await provider.initialize();

    return provider;
  }

  /**
   * Get or create provider instance
   */
  async getProvider(providerName: string): Promise<AIProvider> {
    // Check if instance already exists
    let instance = this.providerInstances.get(providerName);

    if (!instance) {
      // Create new instance
      instance = await this.createProvider(providerName);
      this.providerInstances.set(providerName, instance);
    }

    return instance;
  }

  /**
   * Clear all provider instances
   */
  clearInstances(): void {
    this.providerInstances.clear();
  }

  /**
   * Auto-detect provider from API key
   */
  autoDetectProvider(apiKey: string): string | null {
    if (apiKey.trim().startsWith("sk-ant-")) {
      return "anthropic";
    } else if (apiKey.trim().startsWith("sk-")) {
      return "openai";
    } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(apiKey.trim())) {
      return "bytedance";
    } else if (apiKey.trim().length === 39) {
      return "gemini";
    }
    return null;
  }

  /**
   * Validate API key format for a provider
   */
  validateApiKey(apiKey: string, providerName?: string): { valid: boolean; error?: string } {
    // Auto-detect provider if not specified
    if (!providerName) {
      providerName = this.autoDetectProvider(apiKey);
    }

    if (!providerName) {
      return { valid: false, error: "Cannot auto-detect provider from API key" };
    }

    const providerInfo = this.providerInfo.get(providerName);
    if (providerInfo && providerInfo.defaultApiKeyPrefix) {
      // Check if API key starts with expected prefix
      if (!apiKey.trim().startsWith(providerInfo.defaultApiKeyPrefix)) {
        return {
          valid: false,
          error: `API key must start with "${providerInfo.defaultApiKeyPrefix}"`
        };
      }
    }

    // Get provider instance and validate
    const providerClass = this.getProviderClass(providerName);
    if (providerClass) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new (providerClass as any)({ apiKey });
      const isValid = provider.validateApiKeyFormat(apiKey);
      return isValid ? { valid: true } : { valid: false, error: "Invalid API key format" };
    }

    return { valid: false, error: "Provider not found" };
  }
}

// Export singleton instance
export const providerRegistry = ProviderRegistry.getInstance();
