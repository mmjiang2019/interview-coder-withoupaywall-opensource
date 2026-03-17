// AnthropicProvider.ts - Anthropic Claude API implementation

import Anthropic from "@anthropic-ai/sdk";
import { AIProvider, ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from "./AIProvider";

export class AnthropicProvider extends AIProvider {
  private client: Anthropic | null = null;

  constructor(config: any) {
    super({
      provider: "anthropic",
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      models: [
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
      ],
      defaultModels: {
        extraction: "claude-3-7-sonnet-20250219",
        solution: "claude-3-7-sonnet-20250219",
        debugging: "claude-3-7-sonnet-20250219",
      },
    });
  }

  protected detectCapabilities(): any {
    return {
      supportsVision: true,
      supportsStreaming: true,
      supportsFunctionCalling: false,
    };
  }

  async initialize(): Promise<void> {
    try {
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
      console.log("Anthropic client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Anthropic client:", error);
      this.client = null;
      throw error;
    }
  }

  async chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error("Anthropic client not initialized");
    }

    // Build content array
    const content: any[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      content.push({
        type: "text",
        text: request.systemPrompt,
      });
    }

    // Add user messages
    for (const msg of request.messages) {
      const messageContent: any[] = [];

      // Add text content
      if (msg.content) {
        messageContent.push({
          type: "text",
          text: msg.content,
        });
      }

      // Add images if present
      if (msg.images && msg.images.length > 0) {
        for (const image of msg.images) {
          messageContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: image,
            },
          });
        }
      }

      content.push({
        role: msg.role,
        content: messageContent,
      });
    }

    // Make API call
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 4000,
      messages: content,
      temperature: request.temperature || 0.2,
      stream: false,
    });

    return {
      content: (response.content[0] as { type: "text"; text: string }).text || "",
      rawResponse: response,
    };
  }
}
