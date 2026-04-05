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

  async getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string): Promise<Array<{ id: string; name: string; description: string }>> {
    console.log('[ByteDanceProvider] Starting to fetch models');
    
    // 直接从ModelConfigManager获取配置
    const config = modelConfigManager.getConfig();
    const currentProviderConfig = config.providerConfigs[config.apiProvider];
    const ak = currentProviderConfig.accessKeyId || accessKeyId;
    const sk = currentProviderConfig.secretAccessKey || secretAccessKey;
    
    console.log('[ByteDanceProvider] Received parameters:');
    console.log('[ByteDanceProvider] apiKey:', apiKey ? '***' : 'not provided');
    console.log('[ByteDanceProvider] accessKeyId (from config):', ak ? '***' : 'not provided');
    console.log('[ByteDanceProvider] secretAccessKey (from config):', sk ? '***' : 'not provided');
    
    try {
      // 检查是否提供了Access Key ID和Secret Access Key
      if (!ak || !sk) {
        console.warn('[ByteDanceProvider] Access Key ID or Secret Access Key not provided, using default models');
        throw new Error('Access Key ID and Secret Access Key are required for ByteDance API');
      }
      
      // 生成当前时间戳
      const date = new Date();
      const xDate = date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');
      const dateShort = xDate.substring(0, 8);
      console.log('[ByteDanceProvider] Generated timestamp:', xDate);
      
      // 构建请求体
      const requestBody = JSON.stringify({
        PageNumber: 1,
        PageSize: 10,
        SortOrder: 'Desc',
        SortBy: 'CreateTime'
      });
      console.log('[ByteDanceProvider] Request body:', requestBody);
      
      // 计算Content-SHA256
      const crypto = require('crypto');
      const contentSha256 = crypto.createHash('sha256').update(requestBody).digest('hex');
      console.log('[ByteDanceProvider] Content-SHA256:', contentSha256);
      
      // 构建查询参数
      const queryParams = new URLSearchParams({
        Action: 'ListFoundationModels',
        Version: '2024-01-01',
        'X-Algorithm': 'HMAC-SHA256',
        'X-Credential': `${ak}/${dateShort}/cn-beijing/ark/request`,
        'X-Date': xDate,
        'X-Expires': '3600',
        'X-NotSignBody': '1',
        'X-SignedHeaders': '',
        'X-SignedQueries': 'Action;Version;X-Algorithm;X-Credential;X-Date;X-Expires;X-NotSignBody;X-SignedHeaders;X-SignedQueries'
      });
      
      // 构建规范化请求字符串
      const canonicalRequest = [
        'POST',
        '/',
        queryParams.toString(),
        `content-type:application/json; charset=utf-8`,
        `host:ark.cn-beijing.volcengineapi.com`,
        '',
        '',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ].join('\n');
      console.log('[ByteDanceProvider] Canonical request:', canonicalRequest);
      
      // 构建签名字符串
      const credentialScope = `${dateShort}/cn-beijing/ark/request`;
      const stringToSign = [
        'HMAC-SHA256',
        xDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
      ].join('\n');
      console.log('[ByteDanceProvider] String to sign:', stringToSign);
      
      // 计算签名（按照火山引擎的签名算法）
      // 1. 计算kDate
      const kDate = crypto.createHmac('sha256', sk)
        .update(dateShort)
        .digest('binary');
      // 2. 计算kRegion
      const kRegion = crypto.createHmac('sha256', kDate)
        .update('cn-beijing')
        .digest('binary');
      // 3. 计算kService
      const kService = crypto.createHmac('sha256', kRegion)
        .update('ark')
        .digest('binary');
      // 4. 计算kSigning
      const kSigning = crypto.createHmac('sha256', kService)
        .update('request')
        .digest('binary');
      // 5. 计算最终签名
      const signature = crypto.createHmac('sha256', kSigning)
        .update(stringToSign)
        .digest('hex');
      console.log('[ByteDanceProvider] Signature:', signature);
      
      // 添加签名到查询参数
      queryParams.append('X-Signature', signature);
      
      // 使用火山引擎的ListFoundationModels API获取模型列表
      console.log('[ByteDanceProvider] Making API request to fetch models');
      const response = await fetch(`https://ark.cn-beijing.volcengineapi.com/?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: requestBody
      });
      
      console.log('[ByteDanceProvider] API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ByteDanceProvider] API request failed:', errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[ByteDanceProvider] API response data:', JSON.stringify(data, null, 2));
      const models = data.Result?.Items || [];
      console.log('[ByteDanceProvider] Found', models.length, 'models');
      
      // 构建模型列表
      const modelList: Array<{ id: string; name: string; description: string }> = models.map((model: any) => ({
        id: model.Name,
        name: model.DisplayName || model.Name,
        description: model.Description || `ByteDance model: ${model.Name}`
      }));
      
      console.log('[ByteDanceProvider] Generated model list:', modelList);
      return modelList;
    } catch (error: any) {
      console.error('[ByteDanceProvider] Error fetching ByteDance models:', error.message);
      // Return default models on error
      console.log('[ByteDanceProvider] Using default models due to error');
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