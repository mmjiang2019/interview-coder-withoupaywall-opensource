// ConfigHelper.ts - Refactored configuration management with provider support

import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
// import { EventEmitter } from "events";
import { providerRegistry, ProviderInfo } from "./providers/ProviderRegistry";

export interface Config {
  apiKey: string;
  apiProvider: string;
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;
  timeout?: number;
  maxRetries?: number;
  baseURL?: string;
}

// export class ConfigHelper extends EventEmitter {
export class ConfigHelper {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: "openai",
    extractionModel: "gpt-4o",
    solutionModel: "gpt-4o",
    debuggingModel: "gpt-4o",
    language: "golang",
    opacity: 1.0,
    timeout: 60000,
    maxRetries: 2,
  };

  constructor() {
    // super();
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }

    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Get all provider info
   */
  public getAllProviderInfo(): ProviderInfo[] {
    return providerRegistry.getAllProviderInfo();
  }

  /**
   * Get available models for a provider
   */
  public getAvailableModels(providerName: string): string[] {
    return providerRegistry.getAvailableModels(providerName);
  }

  /**
   * Get default models for a provider
   */
  public getDefaultModels(providerName: string): string[] {
    return providerRegistry.getDefaultModels(providerName);
  }

  /**
   * Get provider info by name
   */
  public getProviderInfo(providerName: string): ProviderInfo | undefined {
    return providerRegistry.getProviderInfo(providerName);
  }

  /**
   * Load configuration
   */
  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);

        // Ensure apiProvider is a valid value
        const validProviders = ["openai", "gemini", "anthropic", "ollama", "bytedance"];
        if (!validProviders.includes(config.apiProvider)) {
          config.apiProvider = "openai";
        }

        return {
          ...this.defaultConfig,
          ...config,
        };
      }

      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider = updates.apiProvider || currentConfig.apiProvider;

      // Auto-detect provider based on API key format if a new key is provided
      if (updates.apiKey && !updates.apiProvider) {
        const detectedProvider = providerRegistry.autoDetectProvider(updates.apiKey);
        if (detectedProvider) {
          provider = detectedProvider;
          console.log(`Auto-detected provider: ${provider}`);
        }
      }

      // If provider is changing, reset models to the defaults
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        const defaultModels = providerRegistry.getDefaultModels(updates.apiProvider);
        if (defaultModels.length >= 3) {
          updates.extractionModel = defaultModels[0];
          updates.solutionModel = defaultModels[1];
          updates.debuggingModel = defaultModels[2];
        }
      }

      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);

      // Only emit update event for changes that require re-initialization
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined ||
          updates.timeout !== undefined || updates.maxRetries !== undefined ||
          updates.baseURL !== undefined) {
        // this.emit('config-updated', newConfig);
      }

      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.apiKey && config.apiKey.trim().length > 0;
  }

  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: string): boolean {
    return providerRegistry.validateApiKey(apiKey, provider).valid;
  }

  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: string): Promise<{valid: boolean, error?: string}> {
    return providerRegistry.validateApiKey(apiKey, provider);
  }

  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }

  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
