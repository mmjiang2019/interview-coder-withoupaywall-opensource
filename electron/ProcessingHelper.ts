// ProcessingHelper.ts
import fs from "node:fs"
import path from "node:path"
import { BrowserWindow } from 'electron'
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import * as axios from "axios"
import { ModelProviderRegistry } from './ModelProviderRegistry';
import { modelConfigManager } from './config/ModelConfigManager';
import { modelSwitchManager } from './models/ModelSwitchManager';
import { v4 as uuidv4 } from 'uuid';

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private currentClient: any = null;
  private currentProvider: string | null = null;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // Initialize AI client based on config
    this.initializeAIClient();
    
    // Listen for config changes to re-initialize the AI client
    modelConfigManager.onConfigChange(() => {
      this.initializeAIClient();
    });

    // Listen for model switch events
    modelSwitchManager.onSwitch((status, fromProvider, toProvider, error) => {
      this.handleModelSwitchEvent(status, fromProvider, toProvider, error);
    });
  }

  /**
   * Handle model switch events
   */
  private handleModelSwitchEvent(
    status: 'idle' | 'switching' | 'completed' | 'failed',
    fromProvider: string,
    toProvider: string,
    error?: string
  ): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    switch (status) {
      case 'switching':
        mainWindow.webContents.send('model-switch-status', {
          status: 'switching',
          message: `Switching from ${fromProvider} to ${toProvider}...`,
          fromProvider,
          toProvider
        });
        break;
      case 'completed':
        mainWindow.webContents.send('model-switch-status', {
          status: 'completed',
          message: `Successfully switched to ${toProvider}`,
          fromProvider,
          toProvider
        });
        break;
      case 'failed':
        mainWindow.webContents.send('model-switch-status', {
          status: 'failed',
          message: `Failed to switch to ${toProvider}: ${error || 'Unknown error'}`,
          fromProvider,
          toProvider,
          error
        });
        break;
    }
  }
  
  /**
   * Initialize or reinitialize the AI client with current config
   */
  private async initializeAIClient(): Promise<void> {
    try {
      const config = modelConfigManager.getConfig();
      const provider = ModelProviderRegistry.getInstance().getProvider(config.apiProvider);
      
      if (!provider) {
        console.warn(`Unknown provider: ${config.apiProvider}`);
        this.currentClient = null;
        this.currentProvider = null;
        return;
      }
      
      // Validate API key before initializing client
      const apiKey = config.apiKeys[config.apiProvider];
      if (!apiKey) {
        console.warn(`No API key found for ${provider.displayName}`);
        this.currentClient = null;
        this.currentProvider = null;
        return;
      }
      
      const validation = await provider.validateApiKey(apiKey);
      if (!validation.valid) {
        console.warn(`Invalid API key for ${provider.displayName}: ${validation.error}`);
        this.currentClient = null;
        this.currentProvider = null;
        return;
      }
      
      this.currentClient = await provider.getClient(apiKey);
      this.currentProvider = config.apiProvider;
      console.log(`${provider.displayName} client initialized successfully`);
    } catch (error) {
      console.error("Failed to initialize AI client:", error);
      this.currentClient = null;
      this.currentProvider = null;
    }
  }
  
  /**
   * Get the current AI client, initializing it if necessary
   */
  private async getOrInitializeClient(): Promise<any> {
    const config = modelConfigManager.getConfig();
    
    if (!this.currentClient || this.currentProvider !== config.apiProvider) {
      await this.initializeAIClient();
    }
    
    return this.currentClient;
  }
  
  /**
   * Get the current model provider
   */
  private getCurrentProvider(): any {
    const config = modelConfigManager.getConfig();
    return ModelProviderRegistry.getInstance().getProvider(config.apiProvider);
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("App failed to initialize after 5 seconds")
  }

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 999 // Unlimited credits in this version

    try {
      await this.waitForInitialization(mainWindow)
      return 999 // Always return sufficient credits to work
    } catch (error) {
      console.error("Error getting credits:", error)
      return 999 // Unlimited credits as fallback
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get language from config
      const config = modelConfigManager.getConfig();
      if (config.language) {
        return config.language;
      }
      
      // Fallback to window variable if config doesn't have language
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        try {
          await this.waitForInitialization(mainWindow)
          const language = await mainWindow.webContents.executeJavaScript(
            "window.__LANGUAGE__"
          )

          if (
            typeof language === "string" &&
            language !== undefined &&
            language !== null
          ) {
            return language;
          }
        } catch (err) {
          console.warn("Could not get language from window", err);
        }
      }
      
      // Default fallback
      return "python";
    } catch (error) {
      console.error("Error getting language:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return

    // First verify we have a valid AI client
    const client = await this.getOrInitializeClient();
    if (!client) {
      const config = modelConfigManager.getConfig();
      console.error(`${config.apiProvider} client not initialized`);
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.API_KEY_INVALID
      );
      return;
    }

    const view = this.deps.getView()
    console.log("Processing screenshots in view:", view)

    if (view === "queue") {
      await this.processMainQueue(mainWindow);
    } else {
      await this.processExtraQueue(mainWindow);
    }
  }
  
  /**
   * Process screenshots from the main queue
   */
  private async processMainQueue(mainWindow: BrowserWindow): Promise<void> {
    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
    const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
    console.log("Processing main queue screenshots:", screenshotQueue)
    
    // Check if the queue is empty
    if (!screenshotQueue || screenshotQueue.length === 0) {
      console.log("No screenshots found in queue");
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      return;
    }

    // Check that files actually exist
    const existingScreenshots = screenshotQueue.filter(path => fs.existsSync(path));
    if (existingScreenshots.length === 0) {
      console.log("Screenshot files don't exist on disk");
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      return;
    }

    try {
      // Initialize AbortController
      this.currentProcessingAbortController = new AbortController()
      const { signal } = this.currentProcessingAbortController

      const validScreenshots = await this.loadScreenshots(existingScreenshots);
      
      if (validScreenshots.length === 0) {
        throw new Error("Failed to load screenshot data");
      }

      const result = await this.processScreenshotsHelper(validScreenshots, signal)

      if (!result.success) {
        this.handleProcessingError(mainWindow, result.error);
        return;
      }

      // Only set view to solutions if processing succeeded
      console.log("Setting view to solutions after successful processing")
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
        result.data
      )
      this.deps.setView("solutions")
    } catch (error: any) {
      this.handleProcessingError(mainWindow, error.message || "Server error. Please try again.");
    } finally {
      this.currentProcessingAbortController = null
    }
  }
  
  /**
   * Process screenshots from the extra queue (debug mode)
   */
  private async processExtraQueue(mainWindow: BrowserWindow): Promise<void> {
    const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue()
    console.log("Processing extra queue screenshots:", extraScreenshotQueue)
    
    // Check if the extra queue is empty
    if (!extraScreenshotQueue || extraScreenshotQueue.length === 0) {
      console.log("No extra screenshots found in queue");
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      return;
    }

    // Check that files actually exist
    const existingExtraScreenshots = extraScreenshotQueue.filter(path => fs.existsSync(path));
    if (existingExtraScreenshots.length === 0) {
      console.log("Extra screenshot files don't exist on disk");
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
      return;
    }
    
    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

    // Initialize AbortController
    this.currentExtraProcessingAbortController = new AbortController()
    const { signal } = this.currentExtraProcessingAbortController

    try {
      // Get all screenshots (both main and extra) for processing
      const allPaths = [
        ...this.screenshotHelper.getScreenshotQueue(),
        ...existingExtraScreenshots
      ];
      
      const validScreenshots = await this.loadScreenshots(allPaths);
      
      if (validScreenshots.length === 0) {
        throw new Error("Failed to load screenshot data for debugging");
      }
      
      console.log(
        "Combined screenshots for processing:",
        validScreenshots.map((s) => s.path)
      )

      const result = await this.processExtraScreenshotsHelper(
        validScreenshots,
        signal
      )

      if (result.success) {
        this.deps.setHasDebugged(true)
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
          result.data
        )
      } else {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          result.error
        )
      }
    } catch (error: any) {
      if (axios.isCancel(error)) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          "Extra processing was canceled by the user."
        )
      } else {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        )
      }
    } finally {
      this.currentExtraProcessingAbortController = null
    }
  }
  
  /**
   * Load screenshots from paths and return valid ones
   */
  private async loadScreenshots(paths: string[]): Promise<Array<{ path: string; data: string }>> {
    const screenshots = await Promise.all(
      paths.map(async (path) => {
        try {
          if (!fs.existsSync(path)) {
            console.warn(`Screenshot file does not exist: ${path}`);
            return null;
          }
          
          return {
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString('base64')
          };
        } catch (err) {
          console.error(`Error reading screenshot ${path}:`, err);
          return null;
        }
      })
    )

    // Filter out any nulls from failed screenshots
    return screenshots.filter(Boolean) as Array<{ path: string; data: string }>;
  }
  
  /**
   * Handle processing errors
   */
  private handleProcessingError(mainWindow: BrowserWindow, error: string): void {
    console.log("Processing failed:", error)
    if (error?.includes("API Key") || error?.includes("OpenAI") || error?.includes("Gemini")) {
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.API_KEY_INVALID
      )
    } else {
      mainWindow.webContents.send(
        this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        error
      )
    }
    // Reset view back to queue on error
    console.log("Resetting view to queue due to error")
    this.deps.setView("queue")
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    // 生成请求 ID 并注册请求
    const requestId = uuidv4();
    modelSwitchManager.registerRequest(requestId);

    try {
      const config = modelConfigManager.getConfig();
      const language = await this.getLanguage();
      const mainWindow = this.deps.getMainWindow();
      
      // Step 1: Extract problem info using AI Vision API
      const imageDataList = screenshots.map(screenshot => screenshot.data);
      
      // Update the user on progress
      this.updateProcessingStatus(mainWindow, "Analyzing problem from screenshots...", 20);

      const provider = this.getCurrentProvider();
      if (!provider) {
        return {
          success: false,
          error: `Unknown API provider: ${config.apiProvider}`
        };
      }

      const client = await this.getOrInitializeClient();
      if (!client) {
        return {
          success: false,
          error: `${provider.displayName} client not initialized`
        };
      }

      const problemInfo = await this.extractProblemInfo(provider, imageDataList, language, config.extractionModel, signal);
      
      // Update the user on progress
      this.updateProcessingStatus(mainWindow, "Problem analyzed successfully. Preparing to generate solution...", 40);

      // Store problem info in AppState
      this.deps.setProblemInfo(problemInfo);

      // Send first success event
      if (mainWindow) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );

        // Generate solutions after successful extraction
        const solutionsResult = await this.generateSolutionsHelper(signal);
        if (solutionsResult.success) {
          // Clear any existing extra screenshots before transitioning to solutions view
          this.screenshotHelper.clearExtraScreenshotQueue();
          
          // Final progress update
          this.updateProcessingStatus(mainWindow, "Solution generated successfully", 100);
          
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            solutionsResult.data
          );
          return { success: true, data: solutionsResult.data };
        } else {
          throw new Error(
            solutionsResult.error || "Failed to generate solutions"
          );
        }
      }

      return { success: false, error: "Failed to process screenshots" };
    } catch (error: any) {
      return this.handleApiError(error);
    } finally {
      // 完成请求
      modelSwitchManager.completeRequest(requestId);
    }
  }
  
  /**
   * Extract problem information from screenshots
   */
  private async extractProblemInfo(
    provider: any,
    images: string[],
    language: string,
    model: string,
    signal: AbortSignal
  ): Promise<any> {
    // 生成请求 ID 并注册请求
    const requestId = uuidv4();
    modelSwitchManager.registerRequest(requestId);

    try {
      return provider.extractProblemInfo({
        images,
        language,
        model,
        signal
      });
    } finally {
      // 完成请求
      modelSwitchManager.completeRequest(requestId);
    }
  }
  
  /**
   * Update processing status
   */
  private updateProcessingStatus(
    mainWindow: BrowserWindow | null,
    message: string,
    progress: number
  ): void {
    if (mainWindow) {
      mainWindow.webContents.send("processing-status", {
        message,
        progress
      });
    }
  }
  
  /**
   * Handle API errors
   */
  private handleApiError(error: any): { success: boolean; error: string } {
    // If the request was cancelled, don't retry
    if (axios.isCancel(error)) {
      return {
        success: false,
        error: "Processing was canceled by the user."
      };
    }
    
    // Handle API errors
    if (error?.response?.status === 401) {
      return {
        success: false,
        error: "Invalid API key. Please check your settings."
      };
    } else if (error?.response?.status === 429) {
      return {
        success: false,
        error: "API rate limit exceeded. Please try again later."
      };
    } else if (error?.response?.status === 500) {
      return {
        success: false,
        error: "Server error. Please try again later."
      };
    }

    console.error("API Error Details:", error);
    return { 
      success: false, 
      error: error.message || "Failed to process screenshots. Please try again." 
    };
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    // 生成请求 ID 并注册请求
    const requestId = uuidv4();
    modelSwitchManager.registerRequest(requestId);

    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = modelConfigManager.getConfig();
      const mainWindow = this.deps.getMainWindow();
      const provider = this.getCurrentProvider();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (!provider) {
        return {
          success: false,
          error: `Unknown API provider: ${config.apiProvider}`
        };
      }

      // Update progress status
      this.updateProcessingStatus(mainWindow, "Creating optimal solution with detailed explanations...", 60);

      const solution = await provider.generateSolution({
        problemInfo,
        language,
        model: config.solutionModel,
        signal
      });

      const formattedResponse = {
        code: solution.code,
        thoughts: solution.thoughts,
        time_complexity: solution.time_complexity,
        space_complexity: solution.space_complexity
      };

      return { success: true, data: formattedResponse };
    } catch (error: any) {
      return this.handleApiError(error);
    } finally {
      // 完成请求
      modelSwitchManager.completeRequest(requestId);
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    // 生成请求 ID 并注册请求
    const requestId = uuidv4();
    modelSwitchManager.registerRequest(requestId);

    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      const config = modelConfigManager.getConfig();
      const mainWindow = this.deps.getMainWindow();
      const provider = this.getCurrentProvider();

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      if (!provider) {
        return {
          success: false,
          error: `Unknown API provider: ${config.apiProvider}`
        };
      }

      // Update progress status
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Processing debug screenshots...",
          progress: 30
        });
      }

      // Prepare the images for the API call
      const imageDataList = screenshots.map(screenshot => screenshot.data);

      const debugResult = await provider.debugCode({
        problemInfo,
        images: imageDataList,
        language,
        model: config.debuggingModel,
        signal
      });
      
      if (mainWindow) {
        mainWindow.webContents.send("processing-status", {
          message: "Debug analysis complete",
          progress: 100
        });
      }

      const response = {
        code: debugResult.code,
        debug_analysis: debugResult.debug_analysis,
        thoughts: debugResult.thoughts,
        time_complexity: debugResult.time_complexity,
        space_complexity: debugResult.space_complexity
      };

      return { success: true, data: response };
    } catch (error: any) {
      console.error("Debug processing error:", error);
      return { success: false, error: error.message || "Failed to process debug request" };
    } finally {
      // 完成请求
      modelSwitchManager.completeRequest(requestId);
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    this.deps.setHasDebugged(false)

    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
