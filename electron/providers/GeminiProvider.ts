// GeminiProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import { GoogleGenAI } from '@google/genai';
import { modelConfigManager } from '../config/ModelConfigManager';
import { getDefaultModel } from '../config/ModelDefaults';

export class GeminiProvider extends BaseModelProvider {
  name = 'gemini';
  displayName = 'Gemini';
  apiKeyPattern = /^[a-zA-Z0-9_]{39}$/;
  get defaultModels() {
    return {
      extraction: getDefaultModel('gemini', 'extraction'),
      solution: getDefaultModel('gemini', 'solution'),
      debugging: getDefaultModel('gemini', 'debugging')
    };
  }

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const baseValidation = await super.validateApiKey(apiKey);
    if (!baseValidation.valid) return baseValidation;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'test'
      });
      
      if (response.text) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key' };
    } catch (error: any) {
      return { 
        valid: false, 
        error: error.message || 'Failed to validate API key' 
      };
    }
  }

  protected async createClient(apiKey: string): Promise<GoogleGenAI> {
    return new GoogleGenAI({ apiKey });
  }

  async getClient(apiKey: string): Promise<GoogleGenAI> {
    return super.getClient(apiKey) as Promise<GoogleGenAI>;
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
    
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language: ${params.language}`
          },
          ...params.images.map(data => ({
            inlineData: {
              mimeType: "image/png",
              data: data
            }
          }))
        ]
      }
    ];

    const response = await client.models.generateContent({
      model: params.model || this.defaultModels.extraction,
      contents,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    });

    const responseText = response.text;
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

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: promptText
          }
        ]
      }
    ];

    const response = await client.models.generateContent({
      model: params.model || this.defaultModels.solution,
      contents,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    });

    const responseText = response.text;
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

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: debugPrompt
          },
          ...params.images.map(data => ({
            inlineData: {
              mimeType: "image/png",
              data: data
            }
          }))
        ]
      }
    ];

    const response = await client.models.generateContent({
      model: params.model || this.defaultModels.debugging,
      contents,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    });

    const responseText = response.text;
    return this.parseDebugResponse(responseText);
  }

  async getModels(apiKey: string): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      const client = await this.getClient(apiKey);
      // Use Google GenAI SDK to list models
      // Note: The Google GenAI SDK doesn't have a direct models.list() method
      // We'll use the available models from the official documentation
      // and return them as the model list
      return [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'Latest fast and versatile model'
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'Advanced model with enhanced capabilities'
        },
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          description: 'Fast and efficient model for general tasks'
        },
        {
          id: 'gemini-2.0-pro',
          name: 'Gemini 2.0 Pro',
          description: 'Powerful model for complex tasks'
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          description: 'Previous generation fast model'
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          description: 'Previous generation powerful model'
        }
      ];
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      // Return default models on error
      return [
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          description: 'Fast and efficient model for general tasks'
        },
        {
          id: 'gemini-2.0-pro',
          name: 'Gemini 2.0 Pro',
          description: 'Powerful model for complex tasks'
        }
      ];
    }
  }

}