// ByteDanceProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import { OpenAI } from 'openai';
import { getDefaultModel } from '../../src/config/models';
import { modelConfigManager } from '../config/ModelConfigManager';

export class ByteDanceProvider extends BaseModelProvider {
  name = 'bytedance';
  displayName = 'ByteDance';
  apiKeyPattern = /^[a-zA-Z0-9-]{36}$/;
  get defaultModels() {
    return {
      extraction: getDefaultModel('bytedance', 'extraction'),
      solution: getDefaultModel('bytedance', 'solution'),
      debugging: getDefaultModel('bytedance', 'debugging')
    };
  }

  private client: OpenAI | null = null;

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const baseValidation = await super.validateApiKey(apiKey);
    if (!baseValidation.valid) return baseValidation;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: "https://ark.cn-beijing.volces.com/api/v3"
      });
      await client.models.list();
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Failed to validate API key' };
    }
  }

  protected async createClient(apiKey: string): Promise<OpenAI> {
    return new OpenAI({ 
      apiKey,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      timeout: 60000,
      maxRetries: 2
    });
  }

  async getClient(apiKey: string): Promise<OpenAI> {
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
    const apiKey = config.apiKeys[this.name];
    const client = await this.getClient(apiKey);
    const messages = [
      {
        role: "system" as const, 
        content: "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const, 
            text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${params.language}.`
          },
          ...params.images.map(data => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${data}` }
          }))
        ]
      }
    ];

    const response = await client.chat.completions.create({
      model: params.model || this.defaultModels.extraction,
      messages,
      max_tokens: 4000,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = response.choices[0].message.content;
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
    const apiKey = config.apiKeys[this.name];
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

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;

    const response = await client.chat.completions.create({
      model: params.model || this.defaultModels.solution,
      messages: [
        { 
          role: "system", 
          content: "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations." 
        },
        { 
          role: "user", 
          content: promptText 
        }
      ],
      max_tokens: 4000,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = response.choices[0].message.content;
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
    const apiKey = config.apiKeys[this.name];
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

If you include code examples, use proper markdown code blocks with language specification (e.g. \`\`\`java).
`;

    const messages = [
      {
        role: "system" as const,
        content: debugPrompt
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Here are screenshots of my code, the errors or test cases. Please provide a detailed analysis with:
1. What issues you found in my code
2. Specific improvements and corrections
3. Any optimizations that would make the solution better
4. A clear explanation of the changes needed`
          },
          ...params.images.map(data => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${data}` }
          }))
        ]
      }
    ];

    const response = await client.chat.completions.create({
      model: params.model || this.defaultModels.debugging,
      messages,
      max_tokens: 4000,
      temperature: 0.2
    }, { signal: params.signal });

    const responseText = response.choices[0].message.content;
    return this.parseDebugResponse(responseText);
  }

  async getModels(apiKey: string): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      // 生成当前时间戳
      const date = new Date();
      const xDate = date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');
      const dateShort = xDate.substring(0, 8);
      
      // 构建请求体
      const requestBody = JSON.stringify({
        PageNumber: 1,
        PageSize: 100,
        SortOrder: 'Desc',
        SortBy: 'CreateTime'
      });
      
      // 计算Content-SHA256
      const crypto = require('crypto');
      const contentSha256 = crypto.createHash('sha256').update(requestBody).digest('hex');
      
      // 构建规范化请求字符串
      const canonicalRequest = [
        'POST',
        '/',
        'Action=ListFoundationModelVersions&Version=2024-01-01',
        `content-type:application/json; charset=UTF-8`,
        `host:open.volcengineapi.com`,
        `x-content-sha256:${contentSha256}`,
        `x-date:${xDate}`,
        '',
        'host;x-content-sha256;x-date',
        contentSha256
      ].join('\n');
      
      // 构建签名字符串
      const credentialScope = `${dateShort}/cn-beijing/ark/request`;
      const stringToSign = [
        'HMAC-SHA256',
        xDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
      ].join('\n');
      
      // 计算签名
      const signature = crypto.createHmac('sha256', apiKey)
        .update(stringToSign)
        .digest('hex');
      
      // 构建Authorization头部
      const authorization = `HMAC-SHA256 Credential=${apiKey}/${credentialScope}, SignedHeaders=host;x-content-sha256;x-date, Signature=${signature}`;
      
      // 使用火山引擎的ListFoundationModelVersions API获取模型列表
      const response = await fetch('https://open.volcengineapi.com/?Action=ListFoundationModelVersions&Version=2024-01-01', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Date': xDate,
          'X-Content-Sha256': contentSha256,
          'Authorization': authorization
        },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const modelVersions = data.Result?.Items || [];

      // 构建模型列表
      const models: Array<{ id: string; name: string; description: string }> = modelVersions.map((version: any) => ({
        id: `${version.FoundationModelName}-${version.ModelVersion}`,
        name: `${version.FoundationModelName} (${version.ModelVersion})`,
        description: version.Description || `ByteDance model version: ${version.ModelVersion}`
      }));

      return models;
    } catch (error) {
      console.error('Error fetching ByteDance models:', error);
      // Return default models on error
      return [
        {
          id: 'doubao-seed-2-0-pro-260215',
          name: 'Doubao Seed 2.0 Pro',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-2-0-lite-260215',
          name: 'Doubao Seed 2.0 Lite',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-2-0-mini-260215',
          name: 'Doubao Seed 2.0 Mini',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-2-0-code-preview-260215',
          name: 'Doubao Seed 2.0 Code',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-1-8-251228',
          name: 'Doubao Seed 1.8',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-1-6-251015',
          name: 'Doubao Seed 1.6',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-1-6-flash-250615',
          name: 'Doubao Seed 1.6 Flash',
          description: 'Fast and efficient Doubao model'
        },
        {
          id: 'doubao-seed-1-6-pro-250615',
          name: 'Doubao Seed 1.6 Pro',
          description: 'Powerful Doubao model'
        },
        {
          id: 'doubao-seed-1-6-vision-250815',
          name: 'Doubao 1.6 Vision',
          description: 'Previous generation fast model'
        },
        {
          id: 'doubao-1-5-pro-240725',
          name: 'Doubao 1.5 Pro',
          description: 'Previous generation powerful model'
        }
      ];
    }
  }

}