// initModelProviders.ts
import { ModelProviderRegistry } from './ModelProviderRegistry';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { ByteDanceProvider } from './providers/ByteDanceProvider';
import { ZhipuProvider } from './providers/ZhipuProvider';
import { safeLogger } from './SafeLogger';

export function initializeModelProviders() {
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