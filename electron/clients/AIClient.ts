import { Screenshot } from "../../src/types/screenshots"

export type { Screenshot };

export interface AIClientConfig {
  apiKey: string;
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ProcessingResult {
  problem_statement: string;
  constraints: string;
  example_input: string;
  example_output: string;
}

export interface AIClient {
  initialize(config: AIClientConfig): void;
  reset(): void;
  isInitialized(): boolean;
  extractProblemInfo(images: string[], language: string): Promise<ProcessingResult>;
  generateSolutions(problemInfo: ProcessingResult, language: string): Promise<string[]>;
  processExtraScreenshots(screenshots: Array<{ path: string; data: string }>, existingInfo: ProcessingResult): Promise<ProcessingResult>;
}
