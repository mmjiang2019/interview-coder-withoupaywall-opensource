// AIProvider.ts - Unified interface and base class for all AI providers

import * as axios from "axios";
// import { AbortSignal } from "node:abort-controller";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[]; // Base64 encoded images
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatCompletionResponse {
  content: string;
  rawResponse?: any;
}

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  models: string[];
  defaultModels: {
    extraction?: string;
    solution?: string;
    debugging?: string;
  };
}

export interface ProviderCapabilities {
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
}

export abstract class AIProvider {
  protected config: ProviderConfig;
  protected capabilities: ProviderCapabilities;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.capabilities = this.detectCapabilities();
  }

  /**
   * Detect provider capabilities
   */
  protected detectCapabilities(): ProviderCapabilities {
    return {
      supportsVision: false,
      supportsStreaming: false,
      supportsFunctionCalling: false,
    };
  }

  /**
   * Abstract method to initialize the provider
   */
  abstract initialize(): Promise<void>;

  /**
   * Abstract method to chat with the model
   */
  abstract chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse>;

  /**
   * Validate API key format
   */
  protected validateApiKeyFormat(apiKey: string): boolean {
    return apiKey && apiKey.trim().length > 0;
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.config.provider;
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Get capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return this.capabilities;
  }

  /**
   * Check if provider supports vision
   */
  supportsVision(): boolean {
    return this.capabilities.supportsVision;
  }

  /**
   * Check if provider supports streaming
   */
  supportsStreaming(): boolean {
    return this.capabilities.supportsStreaming;
  }

  /**
   * Common JSON parsing helper
   */
  protected parseJSONResponse(responseText: string): any {
    try {
      // Remove markdown code blocks if present
      const jsonText = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      return null;
    }
  }

  /**
   * Common error handling
   */
  protected handleError(error: any, context: string): { success: boolean; error?: string } {
    if (axios.isCancel(error)) {
      return {
        success: false,
        error: "Request was canceled by the user."
      };
    }

    // Handle specific HTTP errors
    if (error?.response?.status === 401) {
      return {
        success: false,
        error: `Invalid ${this.config.provider} API key. Please check your settings.`
      };
    } else if (error?.response?.status === 429) {
      return {
        success: false,
        error: `${this.config.provider} API rate limit exceeded or insufficient credits. Please try again later.`
      };
    } else if (error?.response?.status === 500) {
      return {
        success: false,
        error: `${this.config.provider} server error. Please try again later.`
      };
    }

    console.error(`${context} Error:`, error);
    return {
      success: false,
      error: error.message || `Failed to process with ${this.config.provider} API.`
    };
  }

  /**
   * Build system prompt with language preference
   */
  protected buildSystemPrompt(language: string, taskType: string): string {
    const prompts: Record<string, string> = {
      extraction: `You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.`,
      solution: `You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations.`,
      debugging: `You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.`,
    };

    return prompts[taskType] || prompts.solution;
  }
}
