// initModelProviders.ts
import { ModelProviderRegistry } from './ModelProviderRegistry';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { ByteDanceProvider } from './providers/ByteDanceProvider';
import { ZhipuProvider } from './providers/ZhipuProvider';
import { safeLogger } from './SafeLogger';
import { modelCacheManager } from './config/ModelCacheManager';
import { AIProvider } from './clients/AIClientFactory';

export async function initializeModelProviders() {
  const registry = ModelProviderRegistry.getInstance();
  
  // Register all available providers
  const providers = [
    new OpenAIProvider(),
    new GeminiProvider(),
    new AnthropicProvider(),
    new OllamaProvider(),
    new ByteDanceProvider(),
    new ZhipuProvider()
  ];

  providers.forEach(provider => {
    registry.registerProvider(provider);
    safeLogger.mainLog(`Registered provider: ${provider.displayName}`);
  });
  
  // Force immediate model cache update for all providers
  safeLogger.mainLog('Starting immediate model cache update for all providers...');
  
  // Wait for a short time to ensure all update tasks have started
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if caches are being populated
  const providerNames: AIProvider[] = ['openai', 'gemini', 'anthropic', 'ollama', 'bytedance', 'zhipu'];
  
  // Wait for up to 10 seconds for caches to be populated
  const startTime = Date.now();
  const maxWaitTime = 10000; // 10 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const allCachesPopulated = providerNames.every(providerName => {
      const cache = modelCacheManager.loadModelCache(providerName);
      return cache !== null && cache !== undefined && cache.models.length > 0;
    });
    
    if (allCachesPopulated) {
      safeLogger.mainLog('All model caches populated successfully');
      break;
    }
    
    // Wait for 500ms before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  safeLogger.mainLog('All model providers initialized');
}

// Export providers for direct access if needed
export {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  OllamaProvider,
  ByteDanceProvider,
  ZhipuProvider
}