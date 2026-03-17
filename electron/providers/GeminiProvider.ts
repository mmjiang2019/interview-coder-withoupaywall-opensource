// GeminiProvider.ts - Google Gemini API implementation

import * as axios from "axios";
import { AIProvider, ChatMessage, ChatCompletionRequest, ChatCompletionResponse } from "./AIProvider";

export interface GeminiMessage {
  role: string;
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

export class GeminiProvider extends AIProvider {
  private apiKey: string | null = null;

  constructor(config: any) {
    super({
      provider: "gemini",
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 2,
      models: ["gemini-1.5-pro", "gemini-2.0-flash"],
      defaultModels: {
        extraction: "gemini-2.0-flash",
        solution: "gemini-2.0-flash",
        debugging: "gemini-2.0-flash",
      },
    });
    this.apiKey = config.apiKey;
  }

  protected detectCapabilities(): any {
    return {
      supportsVision: true,
      supportsStreaming: false,
      supportsFunctionCalling: false,
    };
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      console.warn("Gemini API key not set");
      return;
    }
    console.log("Gemini client initialized successfully");
  }

  async chat(request: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Build Gemini message structure
    const geminiMessages: GeminiMessage[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      geminiMessages.push({
        role: "user",
        parts: [{ text: request.systemPrompt }],
      });
    }

    // Add user messages
    for (const msg of request.messages) {
      const parts: any[] = [];

      // Add text content
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Add images if present
      if (msg.images && msg.images.length > 0) {
        for (const image of msg.images) {
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: image,
            },
          });
        }
      }

      geminiMessages.push({
        role: msg.role,
        parts,
      });
    }

    // Make API request to Gemini
    const response = await axios.default.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`,
      {
        contents: geminiMessages,
        generationConfig: {
          temperature: request.temperature || 0.2,
          maxOutputTokens: request.maxTokens || 4000,
        },
      },
      { signal }
    );

    const responseData = response.data as GeminiResponse;

    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error("Empty response from Gemini API");
    }

    return {
      content: responseData.candidates[0].content.parts[0].text || "",
      rawResponse: response.data,
    };
  }
}
