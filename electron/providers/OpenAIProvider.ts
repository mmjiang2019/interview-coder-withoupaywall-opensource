// OpenAIProvider.ts - OpenAI API implementation

import { OpenAI } from "openai";
import { AIProvider, ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from "./AIProvider";

export class OpenAIProvider extends AIProvider {
  private client: OpenAI | null = null;

  constructor(config: any) {
    super({
      provider: "openai",
      apiKey: config.apiKey,
      baseURL: config.baseURL || undefined,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      models: ["gpt-4o", "gpt-4o-mini"],
      defaultModels: {
        extraction: "gpt-4o",
        solution: "gpt-4o",
        debugging: "gpt-4o",
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
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL || undefined,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
      console.log("OpenAI client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
      this.client = null;
      throw error;
    }
  }

  async chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
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
      if (msg.images && msg.images.length > 0) {
        // Handle multimodal messages
        const content: any[] = [
          {
            type: "text",
            text: msg.content,
          },
        ];

        for (const image of msg.images) {
          content.push({
            type: "image_url",
            image_url: {
              url: image,
            },
          });
        }

        messages.push({
          role: msg.role,
          content,
        });
      } else {
        // Handle text-only messages
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
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
}
