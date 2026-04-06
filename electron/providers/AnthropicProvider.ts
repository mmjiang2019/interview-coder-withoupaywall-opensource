// AnthropicProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import Anthropic from '@anthropic-ai/sdk';
import { modelConfigManager } from '../config/ModelConfigManager';
import { modelCacheManager, CachedModel } from '../config/ModelCacheManager';
import { getDefaultModel } from '../../src/config/models';
import { safeLogger } from '../SafeLogger';

export class AnthropicProvider extends BaseModelProvider {
  name = 'anthropic';
  displayName = 'Anthropic';
  apiKeyPattern = /^sk-ant-[a-zA-Z0-9-]{95}$/;
  get defaultModels() {
    return {
      extraction: getDefaultModel('anthropic', 'extraction'),
      solution: getDefaultModel('anthropic', 'solution'),
      debugging: getDefaultModel('anthropic', 'debugging')
    };
  }

  constructor() {
    super();
    // 启动定时更新模型列表的任务
    this.startModelUpdateTask();
  }

  private startModelUpdateTask(): void {
    modelCacheManager.startUpdateTask('anthropic', async () => {
      try {
        const config = modelConfigManager.getConfig();
        const currentProviderConfig = config.providerConfigs['anthropic'];
        const apiKey = currentProviderConfig.apiKey;

        if (!apiKey) {
          safeLogger.warn('[AnthropicProvider] API key not provided, cannot update model cache');
          return [];
        }

        return await this.fetchModelsFromAPI(apiKey);
      } catch (error) {
        safeLogger.mainError('[AnthropicProvider] Error in model update task:', error);
        return [];
      }
    });
  }

  private async fetchModelsFromAPI(apiKey: string): Promise<CachedModel[]> {
    const client = new Anthropic({ apiKey });
    // Anthropic API doesn't have a direct models.list() method
    // Using hardcoded models for now
    return [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful Claude model (claude-3-opus-20240229)'
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed (claude-3-sonnet-20240229)'
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest Claude model (claude-3-haiku-20240307)'
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        description: 'Previous generation model (claude-2.1)'
      },
      {
        id: 'claude-2',
        name: 'Claude 2',
        description: 'Previous generation model (claude-2)'
      }
    ];
  }

  private client: Anthropic | null = null;

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const baseValidation = await super.validateApiKey(apiKey);
    if (!baseValidation.valid) return baseValidation;

    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: this.defaultModels.extraction,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Test' }]
      });
      return { valid: true };
    } catch (error: any) {
      if (error?.status === 401) {
        return { valid: false, error: 'Invalid Anthropic API key' };
      }
      return { valid: false, error: error.message || 'Failed to validate API key' };
    }
  }

  protected async createClient(apiKey: string): Promise<Anthropic> {
    return new Anthropic({ 
      apiKey,
      timeout: 60000,
      maxRetries: 2
    });
  }

  async getClient(apiKey: string): Promise<Anthropic> {
    return super.getClient(apiKey);
  }

  async extractProblemInfo(params: {
    images: string[];
    language: string;
    model?: string;
    signal?: AbortSignal;
  }): Promise<{
    problem_statement: string;
    constraints?: string;
    example_input?: string;
    example_output?: string;
  }> {
    const config = modelConfigManager.getConfig();
    const apiKey = config.apiKeys[config.apiProvider];
    const client = await this.getClient(apiKey);
    // Note: In a real implementation, the API key should be passed through params or stored securely
    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language: ${params.language}`
          },
          ...params.images.map(data => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/png" as const,
              data: data
            }
          }))
        ]
      }
    ];

    const response = await client.messages.create({
      model: params.model || this.defaultModels.extraction,
      max_tokens: 4000,
      messages: messages,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = (response.content[0] as { type: 'text', text: string }).text;
    const jsonText = responseText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonText);
  }

  async generateSolution(params: {
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
  }> {
    const config = modelConfigManager.getConfig();
    const apiKey = config.apiKeys[config.apiProvider];
    const client = await this.getClient(apiKey);
    const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${params.problemInfo.problem_statement}

CONSTRAINTS:
${params.problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${params.problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${params.problemInfo.example_output || "No example output provided."}

LANGUAGE: ${params.language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${params.language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)
`;

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: promptText
          }
        ]
      }
    ];

    const response = await client.messages.create({
      model: params.model || this.defaultModels.solution,
      max_tokens: 4000,
      messages: messages,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = (response.content[0] as { type: 'text', text: string }).text;
    return this.parseSolutionResponse(responseText);
  }

  async debugCode(params: {
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
  }> {
    const config = modelConfigManager.getConfig();
    const apiKey = config.apiKeys[config.apiProvider];
    const client = await this.getClient(apiKey);
    const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${params.problemInfo.problem_statement}" in ${params.language}. I need help with debugging or improving my solution.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE WITH THESE SECTION HEADERS:
### Issues Identified
- List each issue as a bullet point with clear explanation

### Specific Improvements and Corrections
- List specific code changes needed as bullet points

### Optimizations
- List any performance optimizations if applicable

### Explanation of Changes Needed
Here provide a clear explanation of why the changes are needed

### Key Points
- Summary bullet points of the most important takeaways

If you include code examples, use proper markdown code blocks with language specification.
`;

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: debugPrompt
          },
          ...params.images.map(data => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/png" as const,
              data: data
            }
          }))
        ]
      }
    ];

    const response = await client.messages.create({
      model: params.model || this.defaultModels.debugging,
      max_tokens: 4000,
      messages: messages,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = (response.content[0] as { type: 'text', text: string }).text;
    return this.parseDebugResponse(responseText);
  }

  async getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string, keyword?: string): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      // 首先尝试从缓存获取模型列表
      const cache = modelCacheManager.loadModelCache('anthropic');
      if (cache && !modelCacheManager.isCacheExpired('anthropic')) {
        safeLogger.mainLog('[AnthropicProvider] Using cached model list');
        let modelList = cache.models;
        
        // 如果有关键字过滤
        if (keyword) {
          modelList = modelList.filter(model => 
            model.name.toLowerCase().includes(keyword.toLowerCase()) ||
            model.description.toLowerCase().includes(keyword.toLowerCase())
          );
          safeLogger.mainLog('[AnthropicProvider] Filtered models by keyword:', keyword, 'found:', modelList.length);
        }
        
        return modelList;
      }
      
      // 缓存不存在或过期，从API获取
      safeLogger.mainLog('[AnthropicProvider] Cache expired or not found, fetching from API');
      const modelsFromAPI = await this.fetchModelsFromAPI(apiKey);
      
      // 保存到缓存
      modelCacheManager.saveModelCache('anthropic', modelsFromAPI);
      
      // 如果有关键字过滤
      let modelList = modelsFromAPI;
      if (keyword) {
        modelList = modelList.filter(model => 
          model.name.toLowerCase().includes(keyword.toLowerCase()) ||
          model.description.toLowerCase().includes(keyword.toLowerCase())
        );
        safeLogger.mainLog('[AnthropicProvider] Filtered models by keyword:', keyword, 'found:', modelList.length);
      }
      
      return modelList;
    } catch (error) {
      safeLogger.mainError('Error fetching Anthropic models:', error);
      // Return default models on error
      return [
        {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet',
          description: 'Latest Claude model with enhanced capabilities'
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          description: 'Balanced performance and efficiency'
        }
      ];
    }
  }

}