import { AIClient, AIClientConfig } from "./AIClient";
import { OpenAIClient } from "./OpenAIClient";
import { AnthropicClient } from "./AnthropicClient";

export type AIProvider = "openai" | "anthropic" | "gemini" | "ollama";

export class AIClientFactory {
  private static instance: AIClientFactory;
  private clients: Map<AIProvider, AIClient> = new Map();

  private constructor() {}

  public static getInstance(): AIClientFactory {
    if (!AIClientFactory.instance) {
      AIClientFactory.instance = new AIClientFactory();
    }
    return AIClientFactory.instance;
  }

  public getClient(provider: AIProvider): AIClient {
    const client = this.clients.get(provider);
    if (!client) {
      const newClient = this.createClient(provider);
      this.clients.set(provider, newClient);
      return newClient;
    }
    return client;
  }

  private createClient(provider: AIProvider): AIClient {
    switch (provider) {
      case "openai":
        return new OpenAIClient();
      case "anthropic":
        return new AnthropicClient();
      case "gemini":
        throw new Error("Gemini client not implemented yet");
      case "ollama":
        throw new Error("Ollama client not implemented yet");
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  public initializeClient(provider: AIProvider, config: AIClientConfig): void {
    const client = this.getClient(provider);
    client.initialize(config);
  }

  public resetClient(provider: AIProvider): void {
    const client = this.clients.get(provider);
    if (client) {
      client.reset();
      this.clients.delete(provider);
    }
  }

  public resetAllClients(): void {
    this.clients.forEach((client, provider) => {
      client.reset();
    });
    this.clients.clear();
  }
}

export const aiClientFactory = AIClientFactory.getInstance();
