import { OpenAI } from "openai";
import { AIClient, AIClientConfig, ProcessingResult } from "./AIClient";

export class OpenAIClient implements AIClient {
  private client: OpenAI | null = null;

  initialize(config: AIClientConfig): void {
    try {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 60000,
        maxRetries: config.maxRetries || 2
      });
      console.log("OpenAI client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
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
      throw new Error("OpenAI client not initialized");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language is ${language}.`
              },
              ...images.map(data => ({
                type: "image_url",
                image_url: { url: `data:image/png;base64,${data}` }
              }))
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2
      });

      const responseText = response.choices[0].message.content;
      if (!responseText) {
        throw new Error("Empty response from OpenAI");
      }

      const jsonText = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error: any) {
      console.error("Error calling OpenAI API:", error);
      throw new Error(error.message || "Failed to extract problem info with OpenAI");
    }
  }

  async generateSolutions(problemInfo: ProcessingResult, language: string): Promise<string[]> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a coding expert. Generate multiple solutions for the given problem in ${language}.`
          },
          {
            role: "user",
            content: JSON.stringify(problemInfo)
          }
        ],
        temperature: 0.7,
        n: 3
      });

      return response.choices.map(choice => choice.message.content || "");
    } catch (error: any) {
      console.error("Error generating solutions with OpenAI:", error);
      throw new Error(error.message || "Failed to generate solutions with OpenAI");
    }
  }

  async processExtraScreenshots(screenshots: Screenshot[], existingInfo: ProcessingResult): Promise<ProcessingResult> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: "Update the existing problem information with any new details from additional screenshots."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Existing info: ${JSON.stringify(existingInfo)}\nAnalyze these additional screenshots and update the information.`
              },
              ...screenshots.map(screenshot => ({
                type: "image_url",
                image_url: { url: `data:image/png;base64,${screenshot.base64}` }
              }))
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2
      });

      const responseText = response.choices[0].message.content;
      if (!responseText) {
        throw new Error("Empty response from OpenAI");
      }

      const jsonText = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error: any) {
      console.error("Error processing extra screenshots with OpenAI:", error);
      throw new Error(error.message || "Failed to process extra screenshots with OpenAI");
    }
  }
}
