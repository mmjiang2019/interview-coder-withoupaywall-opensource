// GeminiProvider.ts
import { BaseModelProvider } from '../ModelProvider';
import axios from 'axios';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiProvider extends BaseModelProvider {
  name = 'gemini';
  displayName = 'Gemini';
  apiKeyPattern = /^[a-zA-Z0-9]{39}$/;
  defaultModels = {
    extraction: 'gemini-2.0-flash',
    solution: 'gemini-2.0-flash',
    debugging: 'gemini-2.0-flash'
  };

  async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const baseValidation = await super.validateApiKey(apiKey);
    if (!baseValidation.valid) return baseValidation;

    try {
      const response = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          data: { contents: [{ parts: [{ text: "test" }] }] },
          timeout: 5000
        }
      );
      
      if (response.status === 200) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key' };
    } catch (error: any) {
      return { 
        valid: false, 
        error: error.response?.status === 400 ? 'Invalid Gemini API key' : 'Failed to validate API key' 
      };
    }
  }

  async getClient(apiKey: string): Promise<{ apiKey: string }> {
    return { apiKey };
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
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model || this.defaultModels.extraction}:generateContent?key=${client.apiKey}`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      { signal: params.signal }
    );

    const responseData = response.data as GeminiResponse;
    const responseText = responseData.candidates[0].content.parts[0].text;
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
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model || this.defaultModels.solution}:generateContent?key=${client.apiKey}`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      { signal: params.signal }
    );

    const responseData = response.data as GeminiResponse;
    const responseText = responseData.candidates[0].content.parts[0].text;
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
      `https://generativelanguage.googleapis.com/v1beta/models/${params.model || this.defaultModels.debugging}:generateContent?key=${client.apiKey}`,
      {
        contents: messages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000
        }
      },
      { signal: params.signal }
    );

    const responseData = response.data as GeminiResponse;
    const responseText = responseData.candidates[0].content.parts[0].text;
    return this.parseDebugResponse(responseText);
  }


}