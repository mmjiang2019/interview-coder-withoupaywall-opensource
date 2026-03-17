// ProcessingHelper.ts - Refactored AI processing with provider pattern

import fs from "node:fs";
import path from "node:path";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { IProcessingHelperDeps } from "./main";
import { configHelper } from "./ConfigHelper";
import { providerRegistry } from "./providers/ProviderRegistry";
import { ChatMessage, ChatCompletionRequest } from "./providers/AIProvider";

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;
  private currentProvider: any = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();
    this.initializeProvider();
  }

  /**
   * Initialize provider based on config
   */
  private async initializeProvider(): Promise<void> {
    const config = configHelper.loadConfig();
    try {
      this.currentProvider = await providerRegistry.getProvider(config.apiProvider);
      console.log(`Provider initialized: ${this.currentProvider.getProviderName()}`);
    } catch (error) {
      console.error("Failed to initialize provider:", error);
      this.currentProvider = null;
    }
  }

  /**
   * Refresh provider (call this when config changes)
   */
  private async refreshProvider(): Promise<void> {
    // Clear all instances to force recreation
    providerRegistry.clearInstances();
    await this.initializeProvider();
  }

  /**
   * Ensure provider is initialized
   */
  private async ensureProvider(): Promise<void> {
    const config = configHelper.loadConfig();

    // If provider is not initialized or provider changed, refresh
    if (!this.currentProvider || this.currentProvider.getProviderName() !== config.apiProvider) {
      await this.refreshProvider();
    }

    if (!this.currentProvider) {
      throw new Error("Provider not initialized");
    }
  }

  /**
   * Get language from config or window
   */
  private async getLanguage(): Promise<string> {
    try {
      const config = configHelper.loadConfig();
      if (config.language) {
        return config.language;
      }

      // Fallback to window variable
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow);
          const language = await mainWindow.webContents.executeJavaScript("window.__LANGUAGE__");
          if (typeof language === "string" && language) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }

      return "python";
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  /**
   * Wait for window initialization
   */
  private async waitForInitialization(mainWindow: any): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript("window.__IS_INITIALIZED__");
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  /**
   * Build messages for API call
   */
  private async buildMessages(
    taskType: "extraction" | "solution" | "debugging",
    content: string,
    images?: string[]
  ): Promise<ChatMessage[]> {
    const language = await this.getLanguage();
    const systemPrompt = this.currentProvider.buildSystemPrompt(language, taskType);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content,
        images,
      },
    ];

    return messages;
  }

  /**
   * Process screenshots helper
   */
  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal?: AbortSignal
  ): Promise<any> {
    try {
      const config = configHelper.loadConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing problem from screenshots...",
          progress: 20,
        });
      }

      // Build messages
      const promptText = `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${language}.`;
      const messages = await this.buildMessages("extraction", promptText, screenshots.map(s => s.data));

      // Call AI
      const response = await this.currentProvider.chat(
        {
          model: config.extractionModel || "gpt-4o",
          messages,
          maxTokens: 4000,
          temperature: 0.2,
        },
        signal
      );

      // Parse response
      const problemInfo = this.currentProvider.parseJSONResponse(response.content);
      if (!problemInfo) {
        throw new Error("Failed to parse problem information");
      }

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Problem analyzed successfully. Preparing to generate solution...",
          progress: 40,
        });
      }

      // Store problem info
      this.deps.setProblemInfo(problemInfo);

      // Generate solutions
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          this.screenshotHelper.clearExtraScreenshotQueue();

          mainWindow.webContents.send("processing-status", {
            message: "Solution generated successfully",
            progress: 100,
          });

          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );

          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(solutionsResult.error || "Failed to generate solutions");
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      return this.currentProvider.handleError(error, "Problem extraction");
    }
  }

  /**
   * Generate solutions helper
   */
  private async generateSolutionsHelper(signal?: AbortSignal): Promise<any> {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Creating optimal solution with detailed explanations...",
          progress: 60,
        });
      }

      // Build prompt
      const promptText = `
Generate a detailed solution for the following coding problem:

PROBLEM STATEMENT:
${problemInfo.problem_statement}

CONSTRAINTS:
${problemInfo.constraints || "No specific constraints provided."}

EXAMPLE INPUT:
${problemInfo.example_input || "No example input provided."}

EXAMPLE OUTPUT:
${problemInfo.example_output || "No example output provided."}

LANGUAGE: ${language}

I need the response in the following format:
1. Code: A clean, optimized implementation in ${language}
2. Your Thoughts: A list of key insights and reasoning behind your approach
3. Time complexity: O(X) with a detailed explanation (at least 2 sentences)
4. Space complexity: O(X) with a detailed explanation (at least 2 sentences)

For complexity explanations, please be thorough. For example: "Time complexity: O(n) because we iterate through the array only once. This is optimal as we need to examine each element at least once to find the solution." or "Space complexity: O(n) because in the worst case, we store all elements in the hashmap. The additional space scales linearly with the input size."

Your solution should be efficient, well-commented, and handle edge cases.
`;

      // Build messages
      const messages = await this.buildMessages("solution", promptText);

      // Call AI
      const response = await this.currentProvider.chat(
        {
          model: config.solutionModel || "gpt-4o",
          messages,
          maxTokens: 4000,
          temperature: 0.2,
        },
        signal
      );

      // Parse response
      const content = response.content;
      const codeMatch = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : content;

      // Extract thoughts
      const thoughtsRegex = /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i;
      const thoughtsMatch = content.match(thoughtsRegex);
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

      // Extract complexity
      const timeComplexityPattern = /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i;
      const spaceComplexityPattern = /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i;

      let timeComplexity = "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations.";
      let spaceComplexity = "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair.";

      const timeMatch = content.match(timeComplexityPattern);
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

      const spaceMatch = content.match(spaceComplexityPattern);
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
        success: true,
        data: {
          code,
          thoughts: thoughts.length > 0 ? thoughts : ["Solution approach based on efficiency and readability"],
          time_complexity: timeComplexity,
          space_complexity: spaceComplexity,
        },
      };
    } catch (error: any) {
      return this.currentProvider.handleError(error, "Solution generation");
    }
  }

  /**
   * Process extra screenshots helper (debugging)
   */
  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal?: AbortSignal
  ): Promise<any> {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = configHelper.loadConfig();
      const mainWindow = this.deps.getMainWindow();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30,
        });
      }

      // Build prompt
      const debugPrompt = `
You are a coding interview assistant helping debug and improve solutions. Analyze these screenshots which include either error messages, incorrect outputs, or test cases, and provide detailed debugging help.

I'm solving this coding problem: "${problemInfo.problem_statement}" in ${language}. I need help with debugging or improving my solution.

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

      // Build messages
      const messages = await this.buildMessages("debugging", debugPrompt, screenshots.map(s => s.data));

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Analyzing code and generating debug feedback...",
          progress: 60,
        });
      }

      // Call AI
      const response = await this.currentProvider.chat(
        {
          model: config.debuggingModel || "gpt-4o",
          messages,
          maxTokens: 4000,
          temperature: 0.2,
        },
        signal
      );

      const content = response.content;

      // Update progress
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100,
        });
      }

      // Parse response
      let extractedCode = "// Debug mode - see analysis below";
      const codeMatch = content.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        extractedCode = codeMatch[1].trim();
      }

      let formattedDebugContent = content;
      if (!content.includes('# ') && !content.includes('## ')) {
        formattedDebugContent = content
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
        success: true,
        data: {
          code: extractedCode,
          debug_analysis: formattedDebugContent,
          thoughts,
          time_complexity: "N/A - Debug mode",
          space_complexity: "N/A - Debug mode",
        },
      };
    } catch (error: any) {
      return this.currentProvider.handleError(error, "Debugging");
    }
  }

  /**
   * Process screenshots - main entry point
   */
  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    const config = configHelper.loadConfig();

    // Ensure provider is initialized
    await this.ensureProvider();

    const view = this.deps.getView();
    console.log("Processing screenshots in view:", view);

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue();

      if (!screenshotQueue || screenshotQueue.length === 0) {
        console.log("No screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
      if (existingScreenshots.length === 0) {
        console.log("Screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      try {
        this.currentProcessingAbortController = new AbortController();
        const { signal } = this.currentProcessingAbortController;

        const screenshots = await Promise.all(
          existingScreenshots.map(async (path) => {
            try {
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64'),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        const validScreenshots = screenshots.filter(Boolean);
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data");
        }

        const result = await this.processScreenshotsHelper(validScreenshots, signal);

        if (!result.success) {
          console.log("Processing failed:", result.error);
          if (result.error?.includes("API Key") || result.error?.includes("Provider")) {
            mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.API_KEY_INVALID);
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            );
          }
          this.deps.setView("queue");
          return;
        }

        console.log("Setting view to solutions after successful processing");
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        );
        this.deps.setView("solutions");
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        );
        console.error("Processing error:", error);
        this.deps.setView("queue");
      } finally {
        this.currentProcessingAbortController = null;
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue();
      console.log("Processing extra queue screenshots:", extraScreenshotQueue);

      if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots found in queue");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
      if (existingExtraScreenshots.length === 0) {
        console.log("Extra screenshot files don't exist on disk");
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

      this.currentExtraProcessingAbortController = new AbortController();
      const { signal } = this.currentExtraProcessingAbortController;

      try {
        const allPaths = [
          ...this.screenshotHelper.getScreenshotQueue(),
          ...existingExtraScreenshots,
        ];

        const screenshots = await Promise.all(
          allPaths.map(async (path) => {
            try {
              if (!fs.existsSync(path)) {
                console.warn(`Screenshot file does not exist: ${path}`);
                return null;
              }
              return {
                path,
                preview: await this.screenshotHelper.getImagePreview(path),
                data: fs.readFileSync(path).toString('base64'),
              };
            } catch (err) {
              console.error(`Error reading screenshot ${path}:`, err);
              return null;
            }
          })
        );

        const validScreenshots = screenshots.filter(Boolean);
        if (validScreenshots.length === 0) {
          throw new Error("Failed to load screenshot data for debugging");
        }

        console.log("Combined screenshots for processing:", validScreenshots.map((s) => s.path));

        const result = await this.processExtraScreenshotsHelper(validScreenshots, signal);

        if (result.success) {
          this.deps.setHasDebugged(true);
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          );
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          );
        }
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        );
      } finally {
        this.currentExtraProcessingAbortController = null;
      }
    }
  }

  /**
   * Cancel ongoing requests
   */
  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    this.deps.setHasDebugged(false);
    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }
}
