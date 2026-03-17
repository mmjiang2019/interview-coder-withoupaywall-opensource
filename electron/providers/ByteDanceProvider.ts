// ByteDanceProvider.ts - ByteDance (Volcengine) API implementation

import { OpenAI } from "openai";
import { AIProvider, ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from "./AIProvider";

export class ByteDanceProvider extends AIProvider {
  private client: OpenAI | null = null;

  constructor(config: any) {
    super({
      provider: "bytedance",
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://ark.cn-beijing.volces.com/api/v3",
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      models: [
        "doubao-seed-1-6-flash-250615",
        "doubao-seed-1-6-250615",
        "doubao-1-5-thinking-vision-pro-250428",
        "deepseek-v3-250324",
        "kimi-k2-250711",
      ],
      defaultModels: {
        extraction: "doubao-seed-1-6-flash-250615",
        solution: "doubao-seed-1-6-flash-250615",
        debugging: "doubao-seed-1-6-flash-250615",
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
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
      console.log("ByteDance client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ByteDance client:", error);
      this.client = null;
      throw error;
    }
  }

  async chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    if (!this.client) {
      throw new Error("ByteDance client not initialized");
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

  protected validateApiKeyFormat(apiKey: string): boolean {
    // ByteDance API keys are UUID format
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(apiKey.trim());
  }
}
