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
  
  // Wait for up to 15 seconds for caches to be populated (increased timeout for API calls)
  const startTime = Date.now();
  const maxWaitTime = 15000; // 15 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const allCachesReady = providerNames.every(providerName => {
      const cache = modelCacheManager.loadModelCache(providerName);
      // Cache is ready if it exists, has models, and is not empty
      return cache !== null && cache !== undefined && cache.models.length > 0;
    });
    
    if (allCachesReady) {
      safeLogger.mainLog('All model caches populated successfully');
      break;
    }
    
    // Check if we have any empty caches that need forced refresh
    const hasEmptyCache = providerNames.some(providerName => {
      const cache = modelCacheManager.loadModelCache(providerName);
      return cache === null || cache === undefined || cache.models.length === 0;
    });
    
    if (hasEmptyCache) {
      safeLogger.mainLog('Some caches are empty, triggering forced refresh...');
      // Trigger refresh for empty caches by re-registering (this will call startModelUpdateTask again)
      providers.forEach(provider => {
        // Force immediate cache update for providers with empty caches
        const providerName = provider.name as AIProvider;
        const cache = modelCacheManager.loadModelCache(providerName);
        if (!cache || !cache.models || cache.models.length === 0) {
          safeLogger.mainLog(`Force refreshing empty cache for provider: ${provider.displayName}`);
          // Re-trigger the update task to refresh empty cache
          // Use type assertion since not all providers have this method
          if ((provider as any).startModelUpdateTask) {
            (provider as any).startModelUpdateTask();
          }
        }
      });
    }
    
    // Wait for 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final check: if some caches are still empty, log a warning
  const emptyProviders = providerNames.filter(providerName => {
    const cache = modelCacheManager.loadModelCache(providerName);
    return !cache || !cache.models || cache.models.length === 0;
  });
  
  if (emptyProviders.length > 0) {
    safeLogger.mainLog(`Warning: Some providers still have empty caches: ${emptyProviders.join(', ')}. This may be due to missing API keys.`);
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