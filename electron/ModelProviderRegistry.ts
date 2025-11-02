// ModelProviderRegistry.ts
import { ModelProvider } from './ModelProvider';

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
}