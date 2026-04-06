// ByteDanceProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import { OpenAI } from 'openai';
import { getDefaultModel } from '../../src/config/models';
import { modelConfigManager } from '../config/ModelConfigManager';
import { modelCacheManager, CachedModel } from '../config/ModelCacheManager';
import * as crypto from 'crypto';
import { safeLogger } from '../SafeLogger';

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

  constructor() {
    super();
    // 启动定时更新模型列表的任务
    this.startModelUpdateTask();
  }

  private startModelUpdateTask(): void {
    modelCacheManager.startUpdateTask('bytedance', async () => {
      try {
        const config = modelConfigManager.getConfig();
        const currentProviderConfig = config.providerConfigs['bytedance'];
        const ak = currentProviderConfig.accessKeyId;
        const sk = currentProviderConfig.secretAccessKey;

        if (!ak || !sk) {
          safeLogger.warn('[ByteDanceProvider] Access Key ID or Secret Access Key not provided, cannot update model cache');
          return [];
        }

        return await this.fetchModelsFromAPI(ak, sk);
      } catch (error) {
        safeLogger.mainError('[ByteDanceProvider] Error in model update task:', error);
        return [];
      }
    });
  }

  private async fetchModelsFromAPI(ak: string, sk: string): Promise<CachedModel[]> {
    // 构建ListFoundationModels请求
    const requestBody = JSON.stringify({
      PageNumber: 1,
      PageSize: 100,
      SortOrder: 'Desc',
      SortBy: 'CreateTime'
    });

    const query = {
      Action: 'ListFoundationModels',
      Version: '2024-01-01'
    };

    const { authorization, xDate, contentSha256 } = this.signRequest({
      method: 'POST',
      path: '/',
      ak,
      sk,
      region: 'cn-beijing',
      service: 'ark',
      query,
      body: requestBody
    });

    const queryString = Object.keys(query)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join('&');

    const response = await fetch(`https://ark.cn-beijing.volcengineapi.com/?${queryString}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'ark.cn-beijing.volcengineapi.com',
        'X-Date': xDate,
        'X-Content-Sha256': contentSha256,
        'Authorization': authorization
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const models = data.Result?.Items || [];

    // 对每个基础模型，调用ListFoundationModelVersions获取其版本信息
    const modelVersionsResults: CachedModel[] = [];

    for (const model of models) {
      const foundationModelName = model.Name;

      // 构建ListFoundationModelVersions请求
      const versionRequestBody = JSON.stringify({
        FoundationModelName: foundationModelName,
        PageNumber: 1,
        PageSize: 100,
        SortOrder: 'Desc',
        SortBy: 'CreateTime',
        Filter: {
          Statuses: ["Published"]
        }
      });

      const versionQuery = {
        Action: 'ListFoundationModelVersions',
        Version: '2024-01-01'
      };

      const { authorization: versionAuth, xDate: versionXDate, contentSha256: versionContentSha256 } = this.signRequest({
        method: 'POST',
        path: '/',
        ak,
        sk,
        region: 'cn-beijing',
        service: 'ark',
        query: versionQuery,
        body: versionRequestBody
      });

      const versionQueryString = Object.keys(versionQuery)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(versionQuery[key])}`)
        .join('&');

      const versionResponse = await fetch(`https://ark.cn-beijing.volcengineapi.com/?${versionQueryString}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'ark.cn-beijing.volcengineapi.com',
          'X-Date': versionXDate,
          'X-Content-Sha256': versionContentSha256,
          'Authorization': versionAuth
        },
        body: versionRequestBody
      });

      if (versionResponse.ok) {
        const versionData = await versionResponse.json();
        const versions = versionData.Result?.Items || [];

        // 从结果中提取ModelId、Description、FoundationModelName
        const modelVersions = versions.map((version: any) => ({
          id: version.ModelId,
          name: version.FoundationModelName,
          description: `${version.Description || 'ByteDance model'} (${version.ModelId})`
        }));

        modelVersionsResults.push(...modelVersions);
      }

      // 添加延迟，避免API限流
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return modelVersionsResults;
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

  private signRequest(params: {
    method: string;
    path: string;
    ak: string;
    sk: string;
    region: string;
    service: string;
    query: Record<string, string>;
    body?: string;
  }): { authorization: string; xDate: string; contentSha256: string } {
    const { method, path, ak, sk, region, service, query, body } = params;
    
    const date = new Date();
    const xDate = date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');
    const dateShort = xDate.substring(0, 8);
    
    const contentSha256 = body 
      ? crypto.createHash('sha256').update(body).digest('hex')
      : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    
    const sortedQueryKeys = Object.keys(query).sort();
    const canonicalQueryString = sortedQueryKeys
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join('&');
    
    const signedHeaders = ['content-type', 'host', 'x-content-sha256', 'x-date'];
    const canonicalHeaders = [
      `content-type:application/json`,
      `host:${service}.${region}.volcengineapi.com`,
      `x-content-sha256:${contentSha256}`,
      `x-date:${xDate}`
    ].join('\n') + '\n';
    
    const canonicalRequest = [
      method,
      path,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders.join(';'),
      contentSha256
    ].join('\n');
    
    const credentialScope = `${dateShort}/${region}/${service}/request`;
    const stringToSign = [
      'HMAC-SHA256',
      xDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // 按照火山引擎官方文档实现签名密钥派生
    // 步骤1: 使用Secret Access Key作为密钥，Date作为输入
    const kDate = crypto.createHmac('sha256', sk).update(dateShort).digest();
    // 步骤2: 使用kDate作为密钥，Region作为输入
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    // 步骤3: 使用kRegion作为密钥，Service作为输入
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    // 步骤4: 使用kService作为密钥，'request'作为输入
    const kSigning = crypto.createHmac('sha256', kService).update('request').digest();
    // 步骤5: 使用kSigning作为密钥，StringToSign作为输入
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    
    const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
    
    return { authorization, xDate, contentSha256 };
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
    const apiKey = config.apiKeys[this.name as any];
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
    if (!responseText) {
      throw new Error('Empty response from API');
    }
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
    const apiKey = config.apiKeys[this.name as any];
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
    if (!responseText) {
      throw new Error('Empty response from API');
    }
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
    const apiKey = config.apiKeys[this.name as any];
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
    if (!responseText) {
      throw new Error('Empty response from API');
    }
    return this.parseDebugResponse(responseText);
  }

  async getModels(apiKey: string, accessKeyId?: string, secretAccessKey?: string, keyword?: string): Promise<Array<{ id: string; name: string; description: string }>> {
    safeLogger.mainLog('[ByteDanceProvider] Starting to fetch models');
    
    const config = modelConfigManager.getConfig();
    const currentProviderConfig = config.providerConfigs[config.apiProvider];
    const ak = currentProviderConfig.accessKeyId || accessKeyId;
    const sk = currentProviderConfig.secretAccessKey || secretAccessKey;
    
    safeLogger.mainLog('[ByteDanceProvider] Received parameters:');
    safeLogger.mainLog('[ByteDanceProvider] apiKey:', apiKey ? '***' : 'not provided');
    safeLogger.mainLog('[ByteDanceProvider] accessKeyId (from config):', ak ? '***' : 'not provided');
    safeLogger.mainLog('[ByteDanceProvider] secretAccessKey (from config):', sk ? '***' : 'not provided');
    safeLogger.mainLog('[ByteDanceProvider] keyword:', keyword || 'not provided');
    
    try {
      if (!ak || !sk) {
        safeLogger.warn('[ByteDanceProvider] Access Key ID or Secret Access Key not provided, using default models');
        throw new Error('Access Key ID and Secret Access Key are required for ByteDance API');
      }
      
      // 首先尝试从缓存获取模型列表
      const cache = modelCacheManager.loadModelCache('bytedance');
      if (cache && !modelCacheManager.isCacheExpired('bytedance')) {
        safeLogger.mainLog('[ByteDanceProvider] Using cached model list');
        let modelList = cache.models;
        
        // 如果有关键字过滤
        if (keyword) {
          modelList = modelList.filter(model => 
            model.name.toLowerCase().includes(keyword.toLowerCase()) ||
            model.description.toLowerCase().includes(keyword.toLowerCase())
          );
          safeLogger.mainLog('[ByteDanceProvider] Filtered models by keyword:', keyword, 'found:', modelList.length);
        }
        
        return modelList;
      }
      
      // 缓存不存在或过期，从API获取
      safeLogger.mainLog('[ByteDanceProvider] Cache expired or not found, fetching from API');
      const modelsFromAPI = await this.fetchModelsFromAPI(ak, sk);
      
      // 保存到缓存
      modelCacheManager.saveModelCache('bytedance', modelsFromAPI);
      
      // 如果有关键字过滤
      let modelList = modelsFromAPI;
      if (keyword) {
        modelList = modelList.filter(model => 
          model.name.toLowerCase().includes(keyword.toLowerCase()) ||
          model.description.toLowerCase().includes(keyword.toLowerCase())
        );
        safeLogger.mainLog('[ByteDanceProvider] Filtered models by keyword:', keyword, 'found:', modelList.length);
      }
      
      safeLogger.mainLog('[ByteDanceProvider] Generated model list:', modelList);
      return modelList;
    } catch (error) {
      safeLogger.mainError('[ByteDanceProvider] Error fetching models:', error);
      // Return default models on error
      safeLogger.mainLog('[ByteDanceProvider] Using default models due to error');
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
