// ModelProviderRegistry.ts
import { ModelProvider } from './ModelProvider';
import { GenericProvider } from './providers/GenericProvider';
import { CustomProvider } from './config/ModelConfigManager';

export class ModelProviderRegistry {
  private static instance: ModelProviderRegistry;
  private providers: Map<string, ModelProvider> = new Map();

  private constructor() {}

  public static getInstance(): ModelProviderRegistry {
    if (!ModelProviderRegistry.instance) {
      ModelProviderRegistry.instance = new ModelProviderRegistry();
    }
    return ModelProviderRegistry.instance;
  }

  public registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  public registerCustomProvider(customProvider: CustomProvider): ModelProvider {
    const provider = new GenericProvider({
      name: customProvider.name,
      displayName: customProvider.displayName,
      apiKeyPattern: customProvider.apiKeyPattern,
      baseUrl: customProvider.baseUrl,
      defaultModels: customProvider.defaultModels
    });
    this.providers.set(customProvider.name, provider);
    return provider;
  }

  public unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  public getProvider(name: string): ModelProvider | undefined {
    return this.providers.get(name);
  }

  public getAllProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  public detectProviderByApiKey(apiKey: string): ModelProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.apiKeyPattern.test(apiKey)) {
        return provider;
      }
    }
    return undefined;
  }

  public clearCustomProviders(): void {
    // 只保留内置提供者
    const builtinProviders = ['openai', 'gemini', 'anthropic', 'ollama', 'bytedance'];
    const providersToRemove = Array.from(this.providers.keys()).filter(name => !builtinProviders.includes(name));
    providersToRemove.forEach(name => this.providers.delete(name));
  }
}