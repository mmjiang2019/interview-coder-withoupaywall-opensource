// GenericProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import axios from 'axios';
import { modelConfigManager } from '../config/ModelConfigManager';

export class GenericProvider extends BaseModelProvider {
  name: string;
  displayName: string;
  apiKeyPattern: RegExp;
  baseUrl: string;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };

  constructor(config: {
    name: string;
    displayName: string;
    apiKeyPattern: string;
    baseUrl: string;
    defaultModels: {
      extraction: string;
      solution: string;
      debugging: string;
    };
  }) {
    super();
    this.name = config.name;
    this.displayName = config.displayName;
    this.apiKeyPattern = new RegExp(config.apiKeyPattern);
    this.baseUrl = config.baseUrl;
    this.defaultModels = config.defaultModels;
  }

  protected async createClient(apiKey: string): Promise<{ apiKey: string; baseUrl: string }> {
    return { apiKey, baseUrl: this.baseUrl };
  }

  async getClient(apiKey: string): Promise<{ apiKey: string; baseUrl: string }> {
    return super.getClient(apiKey) as Promise<{ apiKey: string; baseUrl: string }>;
  }

  async getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string, keyword?: string): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      // 这里实现通用的模型列表查询逻辑
      // 实际实现需要根据不同API的格式进行调整
      const response = await axios.get(
        `${this.baseUrl}/models`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // 假设API返回的模型列表格式
      if (response.data && Array.isArray(response.data.models)) {
        return response.data.models.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          description: model.description || 'No description available'
        }));
      }

      // 如果API格式不同，返回默认模型
      return [
        {
          id: this.defaultModels.extraction,
          name: this.defaultModels.extraction,
          description: 'Default extraction model'
        },
        {
          id: this.defaultModels.solution,
          name: this.defaultModels.solution,
          description: 'Default solution model'
        },
        {
          id: this.defaultModels.debugging,
          name: this.defaultModels.debugging,
          description: 'Default debugging model'
        }
      ];
    } catch (error) {
      console.error('Error fetching models:', error);
      // 出错时返回默认模型
      return [
        {
          id: this.defaultModels.extraction,
          name: this.defaultModels.extraction,
          description: 'Default extraction model'
        },
        {
          id: this.defaultModels.solution,
          name: this.defaultModels.solution,
          description: 'Default solution model'
        },
        {
          id: this.defaultModels.debugging,
          name: this.defaultModels.debugging,
          description: 'Default debugging model'
        }
      ];
    }
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
    const apiKey = config.apiKeys[config.apiProvider as any] || config.customProviders.find(p => p.name === config.apiProvider)?.apiKey;
    const client = await this.getClient(apiKey);
    const messages = [
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

    const response = await axios.post(
      `${client.baseUrl}/generateContent`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${client.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: params.signal
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
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
    const apiKey = config.apiKeys[config.apiProvider as any] || config.customProviders.find(p => p.name === config.apiProvider)?.apiKey;
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
        role: "user",
        parts: [
          {
            text: promptText
          }
        ]
      }
    ];

    const response = await axios.post(
      `${client.baseUrl}/generateContent`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${client.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: params.signal
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
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
    const apiKey = config.apiKeys[config.apiProvider as any] || config.customProviders.find(p => p.name === config.apiProvider)?.apiKey;
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

    const response = await axios.post(
      `${client.baseUrl}/generateContent`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${client.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: params.signal
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    return this.parseDebugResponse(responseText);
  }


}