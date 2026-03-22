// OllamaProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import { OpenAI } from 'openai';

export class OllamaProvider extends BaseModelProvider {
  name = 'ollama';
  displayName = 'Ollama';
  apiKeyPattern = /^[a-zA-Z0-9]+$/; // Simple pattern for local API keys
  defaultModels = {
    extraction: 'qwen2.5-it:3b',
    solution: 'qwen2.5-it:3b',
    debugging: 'qwen2.5-it:3b'
  };

  private client: OpenAI | null = null;

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const baseValidation = await super.validateApiKey(apiKey);
    if (!baseValidation.valid) return baseValidation;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: "http://localhost:11434/v1"
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
      baseURL: "http://localhost:11434/v1",
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
    const client = await this.getClient('');
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
    const client = await this.getClient('');
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
    const client = await this.getClient('');
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
      const client = await this.getClient(apiKey);
      // Use OpenAI-compatible API to list models
      const models = await client.models.list();
      return models.data.map(model => ({
        id: model.id,
        name: model.id,
        description: (model as any).description ?? `Ollama model: ${model.id}`
      }));
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      // Return default models on error
      return [
        {
          id: 'qwen2.5-it:3b',
          name: 'Qwen 2.5 IT 3B',
          description: 'Small and fast Qwen model'
        },
        {
          id: 'qwen2.5-it:7b',
          name: 'Qwen 2.5 IT 7B',
          description: 'Medium Qwen model'
        },
        {
          id: 'qwen2.5-it:14b',
          name: 'Qwen 2.5 IT 14B',
          description: 'Large Qwen model'
        },
        {
          id: 'llama3.1:8b',
          name: 'Llama 3.1 8B',
          description: 'Meta Llama 3.1 model'
        },
        {
          id: 'gemma2:9b',
          name: 'Gemma 2 9B',
          description: 'Google Gemma 2 model'
        }
      ];
    }
  }

}