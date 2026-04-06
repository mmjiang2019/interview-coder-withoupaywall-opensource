// ModelProvider.ts
export interface ModelProvider {
  name: string;
  displayName: string;
  apiKeyPattern: RegExp;
  baseUrl?: string;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };
  
  validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
  getClient(apiKey: string): Promise<any>;
  getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string, keyword?: string): Promise<Array<{ id: string; name: string; description: string }>>;

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

import { modelManager } from './models/ModelManager';

export abstract class BaseModelProvider implements ModelProvider {
  abstract name: string;
  abstract displayName: string;
  abstract apiKeyPattern: RegExp;
  abstract defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };

  // 客户端缓存
  private clientCache: Map<string, any> = new Map();

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.apiKeyPattern.test(apiKey)) {
      return { 
        valid: false, 
        error: `Invalid ${this.displayName} API key format` 
      };
    }
    return { valid: true };
  }

  async getClient(apiKey: string): Promise<any> {
    // 从缓存中获取客户端
    if (this.clientCache.has(apiKey)) {
      return this.clientCache.get(apiKey);
    }

    // 创建新客户端
    const client = await this.createClient(apiKey);
    this.clientCache.set(apiKey, client);
    return client;
  }

  // 抽象方法，由具体提供者实现
  protected abstract createClient(apiKey: string): Promise<any>;
  
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

  abstract getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string, keyword?: string): Promise<Array<{ id: string; name: string; description: string }>>;

  /**
   * 获取模型名称
   */
  protected getModelName(type: 'extraction' | 'solution' | 'debugging', model?: string): string {
    return model || this.defaultModels[type];
  }

  /**
   * 检查模型可用性
   */
  protected async checkModelAvailability(modelName: string): Promise<boolean> {
    // 构建模型 ID
    const modelId = `${this.name}-${modelName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    return modelManager.checkModelAvailability(modelId);
  }

  /**
   * 清除客户端缓存
   */
  public clearClientCache(): void {
    this.clientCache.clear();
  }

  /**
   * 获取客户端缓存状态
   */
  public getClientCacheSize(): number {
    return this.clientCache.size;
  }

  protected parseSolutionResponse(responseText: string): {
    code: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  } {
    const codeMatch = responseText.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : responseText;
    
    const thoughtsRegex = /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i;
    const thoughtsMatch = responseText.match(thoughtsRegex);
    let thoughts: string[] = [];
    
    if (thoughtsMatch && thoughtsMatch[1]) {
      const bulletPoints = thoughtsMatch[1].match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g);
      if (bulletPoints) {
        thoughts = bulletPoints.map(point => 
          point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, '').trim()
        ).filter(Boolean);
      } else {
        thoughts = thoughtsMatch[1].split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
      }
    }
    
    const timeComplexityPattern = /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
    const spaceComplexityPattern = /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;
    
    let timeComplexity = "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
    let spaceComplexity = "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";
    
    const timeMatch = responseText.match(timeComplexityPattern);
    if (timeMatch && timeMatch[1]) {
      timeComplexity = timeMatch[1].trim();
      if (!timeComplexity.match(/O\([^)]+\)/i)) {
        timeComplexity = `O(n) - ${timeComplexity}`;
      } else if (!timeComplexity.includes('-') && !timeComplexity.includes('because')) {
        const notationMatch = timeComplexity.match(/O\([^)]+\)/i);
        if (notationMatch) {
          const notation = notationMatch[0];
          const rest = timeComplexity.replace(notation, '').trim();
          timeComplexity = `${notation} - ${rest}`;
        }
      }
    }
    
    const spaceMatch = responseText.match(spaceComplexityPattern);
    if (spaceMatch && spaceMatch[1]) {
      spaceComplexity = spaceMatch[1].trim();
      if (!spaceComplexity.match(/O\([^)]+\)/i)) {
        spaceComplexity = `O(n) - ${spaceComplexity}`;
      } else if (!spaceComplexity.includes('-') && !spaceComplexity.includes('because')) {
        const notationMatch = spaceComplexity.match(/O\([^)]+\)/i);
        if (notationMatch) {
          const notation = notationMatch[0];
          const rest = spaceComplexity.replace(notation, '').trim();
          spaceComplexity = `${notation} - ${rest}`;
        }
      }
    }

    return {
      code,
      thoughts: thoughts.length > 0 ? thoughts : ["Solution approach based on efficiency and readability"],
      time_complexity: timeComplexity,
      space_complexity: spaceComplexity
    };
  }

  protected parseDebugResponse(responseText: string): {
    code: string;
    debug_analysis: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  } {
    let extractedCode = "// Debug mode - see analysis below";
    const codeMatch = responseText.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      extractedCode = codeMatch[1].trim();
    }

    let formattedDebugContent = responseText;
    
    if (!responseText.includes('# ') && !responseText.includes('## ')) {
      formattedDebugContent = responseText
        .replace(/issues identified|problems found|bugs found/i, '## Issues Identified')
        .replace(/code improvements|improvements|suggested changes/i, '## Code Improvements')
        .replace(/optimizations|performance improvements/i, '## Optimizations')
        .replace(/explanation|detailed analysis/i, '## Explanation');
    }

    const bulletPoints = formattedDebugContent.match(/(?:^|\n)[ ]*(?:[-*•]|\d+\.)[ ]+([^\n]+)/g);
    const thoughts = bulletPoints 
      ? bulletPoints.map(point => point.replace(/^[ ]*(?:[-*•]|\d+\.)[ ]+/, '').trim()).slice(0, 5)
      : ["Debug analysis based on your screenshots"];
    
    return {
      code: extractedCode,
      debug_analysis: formattedDebugContent,
      thoughts,
      time_complexity: "N/A - Debug mode",
      space_complexity: "N/A - Debug mode"
    };
  }
}