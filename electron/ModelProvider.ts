// ModelProvider.ts
export interface ModelProvider {
  name: string;
  displayName: string;
  apiKeyPattern: RegExp;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };
  
  validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
  getClient(apiKey: string): Promise<any>;

  // New methods for problem solving and debugging
  extractProblemInfo(params: {
    images: string[];
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    problem_statement: string;
    constraints?: string;
    example_input?: string;
    example_output?: string;
  }>;

  generateSolution(params: {
    problemInfo: {
      problem_statement: string;
      constraints?: string;
      example_input?: string;
      example_output?: string;
    };
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    code: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  }>;

  debugCode(params: {
    problemInfo: {
      problem_statement: string;
      constraints?: string;
      example_input?: string;
      example_output?: string;
    };
    images: string[];
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    code: string;
    debug_analysis: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  }>;
}

export abstract class BaseModelProvider implements ModelProvider {
  abstract name: string;
  abstract displayName: string;
  abstract apiKeyPattern: RegExp;
  abstract defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.apiKeyPattern.test(apiKey)) {
      return { 
        valid: false, 
        error: `Invalid ${this.displayName} API key format` 
      };
    }
    return { valid: true };
  }

  abstract getClient(apiKey: string): Promise<any>;
  
  abstract extractProblemInfo(params: {
    images: string[];
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    problem_statement: string;
    constraints?: string;
    example_input?: string;
    example_output?: string;
  }>;

  abstract generateSolution(params: {
    problemInfo: {
      problem_statement: string;
      constraints?: string;
      example_input?: string;
      example_output?: string;
    };
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    code: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  }>;

  abstract debugCode(params: {
    problemInfo: {
      problem_statement: string;
      constraints?: string;
      example_input?: string;
      example_output?: string;
    };
    images: string[];
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    code: string;
    debug_analysis: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  }>;
}