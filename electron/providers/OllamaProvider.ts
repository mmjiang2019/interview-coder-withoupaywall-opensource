// OllamaProvider.ts - Ollama API implementation

import { OpenAI } from "openai";
import { AIProvider, ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from "./AIProvider";

export class OllamaProvider extends AIProvider {
  private client: OpenAI | null = null;

  constructor(config: any) {
    super({
      provider: "ollama",
      apiKey: config.apiKey,
      baseURL: config.baseURL || "http://localhost:11434/v1",
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      models: [
        "qwen2.5-coder:3b",
        "qwen3:1.7b",
        "qwen2.5-it:3b",
        "gemma3:4b",
      ],
      defaultModels: {
        extraction: "qwen2.5-it:3b",
        solution: "qwen3:1.7b",
        debugging: "qwen3:1.7b",
      },
    });
  }

  protected detectCapabilities(): any {
    return {
      supportsVision: false, // Ollama doesn't support vision natively
      supportsStreaming: true,
      supportsFunctionCalling: false,
    };
  }

  async initialize(): Promise<void> {
    try {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
      console.log("Ollama client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Ollama client:", error);
      this.client = null;
      throw error;
    }
  }

  async chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error("Ollama client not initialized");
    }

    // Build messages array
    const messages: any[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({
        role: "system",
        content: request.systemPrompt,
      });
    }

    // Add user messages
    for (const msg of request.messages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Make API call
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.2,
      stream: false,
    });

    return {
      content: response.choices[0].message.content || "",
      rawResponse: response,
    };
  }

  protected validateApiKeyFormat(apiKey: string): boolean {
    // Ollama doesn't require a specific API key format
    return true;
  }
}
