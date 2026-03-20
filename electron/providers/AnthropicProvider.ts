// AnthropicProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import Anthropic from '@anthropic-ai/sdk';
import { modelConfigManager } from '../config/ModelConfigManager';

export class AnthropicProvider extends BaseModelProvider {
  name = 'anthropic';
  displayName = 'Anthropic';
  apiKeyPattern = /^sk-ant-[a-zA-Z0-9-]{95}$/;
  defaultModels = {
    extraction: 'claude-3-7-sonnet-20250219',
    solution: 'claude-3-7-sonnet-20250219',
    debugging: 'claude-3-7-sonnet-20250219'
  };

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


}