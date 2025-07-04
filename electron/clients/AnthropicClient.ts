import Anthropic from '@anthropic-ai/sdk';
import { AIClient, AIClientConfig, ProcessingResult } from "./AIClient";
import { Screenshot } from "../types/screenshots";

export class AnthropicClient implements AIClient {
  private client: Anthropic | null = null;

  initialize(config: AIClientConfig): void {
    try {
      this.client = new Anthropic({
        apiKey: config.apiKey
      });
      console.log("Anthropic client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Anthropic client:", error);
      this.client = null;
      throw error;
    }
  }

  reset(): void {
    this.client = null;
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async extractProblemInfo(images: string[], language: string): Promise<ProcessingResult> {
    if (!this.client) {
      throw new Error("Anthropic client not initialized");
    }

    try {
      const response = await this.client.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.2,
        system: "You are a coding challenge interpreter. Analyze the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the coding problem details from these images. Return in JSON format. Preferred coding language is ${language}.`
            },
            ...images.map(data => ({
              type: "image",
              source: {
                type: "base64",
                data: data,
                media_type: "image/png"
              }
            }))
          ]
        }]
      });

      const jsonText = response.content[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error: any) {
      console.error("Error calling Anthropic API:", error);
      throw new Error(error.message || "Failed to extract problem info with Anthropic");
    }
  }

  async generateSolutions(problemInfo: ProcessingResult, language: string): Promise<string[]> {
    if (!this.client) {
      throw new Error("Anthropic client not initialized");
    }

    try {
      const solutions: string[] = [];
      
      // Generate 3 different solutions
      for (let i = 0; i < 3; i++) {
        const response = await this.client.messages.create({
          model: "claude-3-opus-20240229",
          temperature: 0.7,
          system: `You are a coding expert. Generate a unique solution for the given problem in ${language}. Make this solution different from previous solutions.`,
          messages: [{
            role: "user",
            content: JSON.stringify(problemInfo)
          }]
        });

        solutions.push(response.content[0].text);
      }

      return solutions;
    } catch (error: any) {
      console.error("Error generating solutions with Anthropic:", error);
      throw new Error(error.message || "Failed to generate solutions with Anthropic");
    }
  }

  async processExtraScreenshots(screenshots: Screenshot[], existingInfo: ProcessingResult): Promise<ProcessingResult> {
    if (!this.client) {
      throw new Error("Anthropic client not initialized");
    }

    try {
      const response = await this.client.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.2,
        system: "Update the existing problem information with any new details from additional screenshots.",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Existing info: ${JSON.stringify(existingInfo)}\nAnalyze these additional screenshots and update the information.`
            },
            ...screenshots.map(screenshot => ({
              type: "image",
              source: {
                type: "base64",
                data: screenshot.base64,
                media_type: "image/png"
              }
            }))
          ]
        }]
      });

      const jsonText = response.content[0].text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error: any) {
      console.error("Error processing extra screenshots with Anthropic:", error);
      throw new Error(error.message || "Failed to process extra screenshots with Anthropic");
    }
  }
}
