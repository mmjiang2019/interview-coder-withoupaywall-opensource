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

  private parseSolutionResponse(responseText: string): {
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

  private parseDebugResponse(responseText: string): {
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