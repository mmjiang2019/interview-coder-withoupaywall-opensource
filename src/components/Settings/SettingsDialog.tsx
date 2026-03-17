// SettingsDialog.tsx - Refactored settings UI with provider system

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";
import { configHelper } from "../../../electron/ConfigHelper";
import { providerRegistry } from "../../../electron/providers/ProviderRegistry";

export function SettingsDialog({ open: externalOpen, onOpenChange }: any) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState("");
  const [testResult, setTestResult] = useState<{valid: boolean, error?: string} | null>(null);
  const { showToast } = useToast();

  // Get all provider info
  const providers = providerRegistry.getAllProviderInfo();

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: string;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
      }

      configHelper.loadConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
          setTestResult(null);
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Handle API provider change
  const handleProviderChange = (provider: string) => {
    setApiProvider(provider);

    // Reset models to defaults when changing provider
    const defaultModels = providerRegistry.getDefaultModels(provider);
    if (defaultModels.length >= 3) {
      setExtractionModel(defaultModels[0]);
      setSolutionModel(defaultModels[1]);
      setDebuggingModel(defaultModels[2]);
    }
  };

  // Handle test API key
  const handleTestApiKey = async () => {
    if (!apiKey) {
      showToast("Error", "Please enter an API key first", "error");
      return;
    }

    setTestingApiKey("testing");
    setTestResult(null);

    try {
      const result = await configHelper.testApiKey(apiKey, apiProvider);
      setTestResult(result);

      if (result.valid) {
        showToast("Success", "API key is valid", "success");
      } else {
        showToast("Error", result.error || "Invalid API key", "error");
      }
    } catch (error) {
      console.error("Failed to test API key:", error);
      showToast("Error", "Failed to test API key", "error");
    } finally {
      setTestingApiKey("");
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
      });

      showToast("Success", "Settings saved successfully", "success");
      handleOpenChange(false);

      // Force reload the app to apply the API key
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  // Get current models for provider
  const getCurrentModels = () => {
    return providerRegistry.getAvailableModels(apiProvider) ||
           providerRegistry.getDefaultModels(apiProvider);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(450px, 90vw)',
          height: 'auto',
          minHeight: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 9999,
          margin: 0,
          padding: '20px',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0.98
        }}
      >
        <DialogHeader>
          <DialogTitle>API Settings</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure your API key and model preferences. You'll need your own API key to use this application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="grid grid-cols-5 gap-2">
              {providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    apiProvider === provider.name
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => handleProviderChange(provider.name)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        apiProvider === provider.name ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div className="flex flex-col">
                      <p className="font-medium text-white text-xs">{provider.displayName}</p>
                      <p className="text-xs text-white/60">{provider.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
              {providers.find(p => p.name === apiProvider)?.displayName} API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providers.find(p => p.name === apiProvider)?.defaultApiKeyPrefix || "Enter your API key"}
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}

            {/* Test API Key Button */}
            {apiKey && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestApiKey}
                disabled={isLoading || testingApiKey !== ""}
                className="border-white/10 hover:bg-white/5 text-white"
              >
                {testingApiKey ? "Testing..." : "Test API Key"}
              </Button>
            )}

            {/* Test Result */}
            {testResult !== null && (
              <div
                className={`p-2 rounded-md text-xs ${
                  testResult.valid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {testResult.valid ? "✓ API key is valid" : `✗ ${testResult.error || "Invalid API key"}`}
              </div>
            )}

            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {providers.find(p => p.name === apiProvider)?.displayName}
            </p>

            {/* Setup Guide */}
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://platform.openai.com/signup')} className="text-blue-400 hover:underline cursor-pointer">OpenAI</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button onClick={() => openExternalLink('https://platform.openai.com/api-keys')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "anthropic" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://console.anthropic.com/signup')} className="text-blue-400 hover:underline cursor-pointer">Anthropic</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://aistudio.google.com/')} className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : apiProvider === "bytedance" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button onClick={() => openExternalLink('https://www.volcengine.com/product/ark')} className="text-blue-400 hover:underline cursor-pointer">ByteDance</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button onClick={() => openExternalLink('https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey')} className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section</p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "ollama" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Install Ollama from <button onClick={() => openExternalLink('https://ollama.com')} className="text-blue-400 hover:underline cursor-pointer">ollama.com</button></p>
                  <p className="text-xs text-white/60 mb-1">2. Pull a model with <button onClick={() => openExternalLink('https://ollama.com/library')} className="text-blue-400 hover:underline cursor-pointer">ollama pull</button></p>
                  <p className="text-xs text-white/60">3. Start the Ollama server and paste your API key here</p>
                </>
              ) : null}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>

                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>

                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>

                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>

                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>

                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>

                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>

                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>

                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>

                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>

                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>

                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>

            {providers.map((provider) => {
              // Get current provider
              const currentProvider = apiProvider === provider.name ? provider : null;

              return (
                <div key={provider.name} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {provider.displayName}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{provider.description}</p>

                  <div className="space-y-2">
                    {provider.defaultModels && (
                      <>
                        {provider.defaultModels.extraction && (
                          <div
                            className={`p-2 rounded-lg cursor-pointer transition-colors ${
                              extractionModel === provider.defaultModels.extraction
                                ? "bg-white/10 border border-white/20"
                                : "bg-black/30 border border-white/5 hover:bg-white/5"
                            }`}
                            onClick={() => setExtractionModel(provider.defaultModels.extraction || "gpt-4o")}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  extractionModel === provider.defaultModels.extraction ? "bg-white" : "bg-white/20"
                                }`}
                              />
                              <div>
                                <p className="font-medium text-white text-xs">{provider.defaultModels.extraction}</p>
                                <p className="text-xs text-white/60">Problem Extraction</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {provider.defaultModels.solution && (
                          <div
                            className={`p-2 rounded-lg cursor-pointer transition-colors ${
                              solutionModel === provider.defaultModels.solution
                                ? "bg-white/10 border border-white/20"
                                : "bg-black/30 border border-white/5 hover:bg-white/5"
                            }`}
                            onClick={() => setSolutionModel(provider.defaultModels.solution || "gpt-4o")}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  solutionModel === provider.defaultModels.solution ? "bg-white" : "bg-white/20"
                                }`}
                              />
                              <div>
                                <p className="font-medium text-white text-xs">{provider.defaultModels.solution}</p>
                                <p className="text-xs text-white/60">Solution Generation</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {provider.defaultModels.debugging && (
                          <div
                            className={`p-2 rounded-lg cursor-pointer transition-colors ${
                              debuggingModel === provider.defaultModels.debugging
                                ? "bg-white/10 border border-white/20"
                                : "bg-black/30 border border-white/5 hover:bg-white/5"
                            }`}
                            onClick={() => setDebuggingModel(provider.defaultModels.debugging || "gpt-4o")}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  debuggingModel === provider.defaultModels.debugging ? "bg-white" : "bg-white/20"
                                }`}
                              />
                              <div>
                                <p className="font-medium text-white text-xs">{provider.defaultModels.debugging}</p>
                                <p className="text-xs text-white/60">Debugging</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Show available models if custom models exist */}
                    {providerRegistry.getAvailableModels(provider.name).length > 0 && (
                      <>
                        {providerRegistry.getAvailableModels(provider.name).map((m) => (
                          <div
                            key={m}
                            className={`p-2 rounded-lg cursor-pointer transition-colors ${
                              extractionModel === m || solutionModel === m || debuggingModel === m
                                ? "bg-white/10 border border-white/20"
                                : "bg-black/30 border border-white/5 hover:bg-white/5"
                            }`}
                            onClick={() => {
                              setExtractionModel(m);
                              setSolutionModel(m);
                              setDebuggingModel(m);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  extractionModel === m || solutionModel === m || debuggingModel === m ? "bg-white" : "bg-white/20"
                                }`}
                              />
                              <div>
                                <p className="font-medium text-white text-xs">{m}</p>
                                <p className="text-xs text-white/60">Available Model</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
