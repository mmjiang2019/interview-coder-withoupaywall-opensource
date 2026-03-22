import { useState, useEffect, useRef } from "react";
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
import { Settings, Search, ChevronDown } from "lucide-react";
import { useToast } from "../../contexts/toast";

type APIProvider = "openai" | "gemini" | "anthropic" | "ollama" | "bytedance" | "zhipu";

type AIModel = {
  id: string;
  name: string;
  description: string;
};

type ModelCategory = {
  key: 'extractionModel' | 'solutionModel' | 'debuggingModel';
  title: string;
  description: string;
  openaiModels: AIModel[];
  geminiModels: AIModel[];
  anthropicModels: AIModel[];
  ollamaModels: AIModel[];
  byteDanceModels: AIModel[];
  zhipuModels: AIModel[];
};

// Define available models for each category
const modelCategories: ModelCategory[] = [
  {
    key: 'extractionModel',
    title: 'Problem Extraction',
    description: 'Model used to analyze screenshots and extract problem details',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    ollamaModels: [
      {
        id: "qwen2.5-coder:3b",
        name: "qwen2.5-coder:3b",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "qwen3:1.7b",
        name: "qwen3:1.7b",
        description: "Faster, more cost-effective option"
      },
      {
        id: "qwen2.5-it:3b",
        name: "qwen2.5-it:3b",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "gemma3:4b",
        name: "gemma3:4b",
        description: "Best overall performance for problem extraction"
      }
    ],
    byteDanceModels: [
      {
        id: "doubao-seed-1-6-flash-250615",
        name: "doubao-seed-1-6-flash-250615",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "doubao-seed-1-6-250615",
        name: "doubao-seed-1-6-250615",
        description: "Faster, more cost-effective option"
      },
      {
        id: "deepseek-v3-250324",
        name: "deepseek-v3-250324",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "kimi-k2-250711",
        name: "kimi-k2-250711",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "doubao-1-5-thinking-vision-pro-250428",
        name: "doubao-1-5-thinking-vision-pro-250428",
        description: "Best overall performance for problem extraction"
      }
    ],
    zhipuModels: [
      {
        id: "glm-5",
        name: "GLM-5",
        description: "Latest GLM model with enhanced capabilities"
      },
      {
        id: "glm-4-flash",
        name: "GLM-4 Flash",
        description: "Fast and efficient GLM model"
      },
      {
        id: "glm-4",
        name: "GLM-4",
        description: "Powerful GLM model"
      },
      {
        id: "glm-4-turbo",
        name: "GLM-4 Turbo",
        description: "High-performance GLM model"
      },
      {
        id: "glm-3-turbo",
        name: "GLM-3 Turbo",
        description: "Previous generation GLM model"
      }
    ]
  },
  {
    key: 'solutionModel',
    title: 'Solution Generation',
    description: 'Model used to generate coding solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    ollamaModels: [
      {
        id: "qwen2.5-coder:3b",
        name: "qwen2.5-coder:3b",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "qwen3:1.7b",
        name: "qwen3:1.7b",
        description: "Faster, more cost-effective option"
      },
      {
        id: "qwen2.5-it:3b",
        name: "qwen2.5-it:3b",
        description: "Balanced performance and speed"
      },
      {
        id: "gemma3:4b",
        name: "gemma3:4b",
        description: "Balanced performance and speed"
      }
    ],
    byteDanceModels: [
      {
        id: "doubao-seed-1-6-flash-250615",
        name: "doubao-seed-1-6-flash-250615",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "doubao-seed-1-6-250615",
        name: "doubao-seed-1-6-250615",
        description: "Faster, more cost-effective option"
      },
      {
        id: "deepseek-v3-250324",
        name: "deepseek-v3-250324",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "kimi-k2-250711",
        name: "kimi-k2-250711",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "doubao-1-5-thinking-vision-pro-250428",
        name: "doubao-1-5-thinking-vision-pro-250428",
        description: "Best overall performance for problem extraction"
      }
    ],
    zhipuModels: [
      {
        id: "glm-5",
        name: "GLM-5",
        description: "Latest GLM model with enhanced capabilities"
      },
      {
        id: "glm-4-flash",
        name: "GLM-4 Flash",
        description: "Fast and efficient GLM model"
      },
      {
        id: "glm-4",
        name: "GLM-4",
        description: "Powerful GLM model"
      },
      {
        id: "glm-4-turbo",
        name: "GLM-4 Turbo",
        description: "High-performance GLM model"
      },
      {
        id: "glm-3-turbo",
        name: "GLM-3 Turbo",
        description: "Previous generation GLM model"
      }
    ]
  },
  {
    key: 'debuggingModel',
    title: 'Debugging',
    description: 'Model used to debug and improve solutions',
    openaiModels: [
      {
        id: "gpt-4o",
        name: "gpt-4o",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gpt-4o-mini",
        name: "gpt-4o-mini",
        description: "Faster, more cost-effective option"
      }
    ],
    geminiModels: [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Faster, more cost-effective option"
      }
    ],
    anthropicModels: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Best for analyzing code and error messages"
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        description: "Balanced performance and speed"
      },
      {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        description: "Top-level intelligence, fluency, and understanding"
      }
    ],
    ollamaModels: [
      {
        id: "qwen2.5-coder:3b",
        name: "qwen2.5-coder:3b",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "qwen3:1.7b",
        name: "qwen3:1.7b",
        description: "Faster, more cost-effective option"
      },
      {
        id: "qwen2.5-it:3b",
        name: "qwen2.5-it:3b",
        description: "Balanced performance and speed"
      },
      {
        id: "gemma3:4b",
        name: "gemma3:4b",
        description: "Balanced performance and speed"
      }
    ],
    byteDanceModels: [
      {
        id: "doubao-seed-1-6-flash-250615",
        name: "doubao-seed-1-6-flash-250615",
        description: "Strong overall performance for coding tasks"
      },
      {
        id: "doubao-seed-1-6-250615",
        name: "doubao-seed-1-6-250615",
        description: "Faster, more cost-effective option"
      },
      {
        id: "deepseek-v3-250324",
        name: "deepseek-v3-250324",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "kimi-k2-250711",
        name: "kimi-k2-250711",
        description: "Best overall performance for problem extraction"
      },
      {
        id: "doubao-1-5-thinking-vision-pro-250428",
        name: "doubao-1-5-thinking-vision-pro-250428",
        description: "Best overall performance for problem extraction"
      }
    ],
    zhipuModels: [
      {
        id: "glm-5",
        name: "GLM-5",
        description: "Latest GLM model with enhanced capabilities"
      },
      {
        id: "glm-4-flash",
        name: "GLM-4 Flash",
        description: "Fast and efficient GLM model"
      },
      {
        id: "glm-4",
        name: "GLM-4",
        description: "Powerful GLM model"
      },
      {
        id: "glm-4-turbo",
        name: "GLM-4 Turbo",
        description: "High-performance GLM model"
      },
      {
        id: "glm-3-turbo",
        name: "GLM-3 Turbo",
        description: "Previous generation GLM model"
      }
    ]
  }
];

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Define API providers
const providers = [
  { id: "openai", name: "OpenAI", description: "GPT-4o models" },
  { id: "gemini", name: "Gemini", description: "Gemini 1.5 models" },
  { id: "anthropic", name: "Claude", description: "Claude 3 models" },
  { id: "ollama", name: "Ollama", description: "Mixed models" },
  { id: "bytedance", name: "Bytedance", description: "Mixed models" },
  { id: "zhipu", name: "Zhipu", description: "GLM models" }
];

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("gpt-4o");
  const [solutionModel, setSolutionModel] = useState("gpt-4o");
  const [debuggingModel, setDebuggingModel] = useState("gpt-4o");
  const [isLoading, setIsLoading] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showExtractionModelDropdown, setShowExtractionModelDropdown] = useState(false);
  const [showSolutionModelDropdown, setShowSolutionModelDropdown] = useState(false);
  const [showDebuggingModelDropdown, setShowDebuggingModelDropdown] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const extractionModelRef = useRef<HTMLDivElement>(null);
  const solutionModelRef = useRef<HTMLDivElement>(null);
  const debuggingModelRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
        setShowProviderDropdown(false);
      }
      if (extractionModelRef.current && !extractionModelRef.current.contains(event.target as Node)) {
        setShowExtractionModelDropdown(false);
      }
      if (solutionModelRef.current && !solutionModelRef.current.contains(event.target as Node)) {
        setShowSolutionModelDropdown(false);
      }
      if (debuggingModelRef.current && !debuggingModelRef.current.contains(event.target as Node)) {
        setShowDebuggingModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter providers based on search input
  const filteredProviders = providers.filter(provider => 
    provider.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
    provider.description.toLowerCase().includes(providerSearch.toLowerCase())
  );

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // 存储所有提供者的API key
  const [apiKeys, setApiKeys] = useState<Record<APIProvider, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
    ollama: "",
    bytedance: "",
    zhipu: ""
  });



  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
        apiKeys?: Record<APIProvider, string>;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKeys(config.apiKeys || {
            openai: "",
            anthropic: "",
            gemini: "",
            ollama: "",
            bytedance: "",
            zhipu: ""
          });
          setApiKey(config.apiKey || "");
          setApiProvider(config.apiProvider || "openai");
          setExtractionModel(config.extractionModel || "gpt-4o");
          setSolutionModel(config.solutionModel || "gpt-4o");
          setDebuggingModel(config.debuggingModel || "gpt-4o");
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
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    // 加载对应提供者的API key
    setApiKey(apiKeys[provider] || "");
    
    // 保持当前模型选择，不重置为默认值
    // 这样可以确保模型切换时，之前选择的模型不会丢失
  };

  // Handle API key change
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    // 更新apiKeys状态中的对应提供者的API key
    setApiKeys(prev => ({
      ...prev,
      [apiProvider]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 更新apiKeys对象，将当前API key保存到对应的提供者
      const updatedApiKeys = {
        ...apiKeys,
        [apiProvider]: apiKey
      };
      
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        apiKeys: updatedApiKeys
      });
      
      if (result) {
        // 更新本地apiKeys状态
        setApiKeys(updatedApiKeys);
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Force reload the app to apply the API key
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
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
            <div ref={providerRef} className="relative">
              <div 
                className="relative cursor-pointer"
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              >
                <input
                  type="text"
                  value={providers.find(p => p.id === apiProvider)?.name || ''}
                  readOnly
                  placeholder="Select API provider"
                  className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
              </div>
              {showProviderDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-black border border-white/10 rounded-lg shadow-lg p-4">
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search providers..."
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        className="bg-black/50 border border-white/10 text-white pl-10"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="p-2 hover:bg-white/10 rounded cursor-pointer"
                        onClick={() => {
                          handleProviderChange(provider.id as APIProvider);
                          setShowProviderDropdown(false);
                        }}
                      >
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-white/60">{provider.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
            {apiProvider === "openai" ? "OpenAI API Key" : 
             apiProvider === "gemini" ? "Gemini API Key" : 
             apiProvider === "ollama" ? "Ollama API Key" : 
             apiProvider === "bytedance" ? "Bytedance API Key" :
             apiProvider === "zhipu" ? "Zhipu API Key" :
             "Anthropic API Key"}
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={
                apiProvider === "openai" ? "sk-..." : 
                apiProvider === "gemini" ? "Enter your Gemini API key" :
                apiProvider === "zhipu" ? "Enter your Zhipu API key" :
                "sk-ant-..."
              }
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {apiProvider === "openai" ? "OpenAI" : apiProvider === "zhipu" ? "Zhipu" : "Google"}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              {apiProvider === "openai" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://platform.openai.com/signup')} 
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://platform.openai.com/api-keys')} 
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "ollama" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://ollama.com/signin')}
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://ollama.com')}
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "bytedance" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://www.volcengine.com/product/ark')}
                    className="text-blue-400 hover:underline cursor-pointer">OpenAI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to <button 
                    onClick={() => openExternalLink('https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D')}
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
                </>
              ) : apiProvider === "gemini" ?  (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/')}
                    className="text-blue-400 hover:underline cursor-pointer">Google AI Studio</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : apiProvider === "zhipu" ? (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://www.bigmodel.cn/')}
                    className="text-blue-400 hover:underline cursor-pointer">Zhipu AI</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://www.bigmodel.cn/usercenter/apikeys')}
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-white/60 mb-1">1. Create an account at <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/signup')}
                    className="text-blue-400 hover:underline cursor-pointer">Anthropic</button>
                  </p>
                  <p className="text-xs text-white/60 mb-1">2. Go to the <button 
                    onClick={() => openExternalLink('https://console.anthropic.com/settings/keys')}
                    className="text-blue-400 hover:underline cursor-pointer">API Keys</button> section
                  </p>
                  <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
                </>
              )}
            </div>
          </div>
          
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
          

          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>
            
            {modelCategories.map((category) => {
              // Get the appropriate model list based on selected provider
              const models = 
                apiProvider === "openai" ? category.openaiModels : 
                apiProvider === "gemini" ? category.geminiModels :
                apiProvider === "ollama" ? category.ollamaModels :
                apiProvider === "bytedance" ? category.byteDanceModels :
                apiProvider === "zhipu" ? category.zhipuModels :
                category.anthropicModels;
              
              // Determine which state to use based on category key
              const currentValue = 
                category.key === 'extractionModel' ? extractionModel :
                category.key === 'solutionModel' ? solutionModel :
                debuggingModel;
              
              // Determine which setter function to use
              const setValue = 
                category.key === 'extractionModel' ? setExtractionModel :
                category.key === 'solutionModel' ? setSolutionModel :
                setDebuggingModel;
              
              // State for search filter
              const [searchFilter, setSearchFilter] = useState('');
              
              // Filter models based on search input
              const filteredModels = models.filter(model => 
                model.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                model.description.toLowerCase().includes(searchFilter.toLowerCase())
              );
              
              // 为每个模型分类获取对应的弹窗状态和引用
              const [showDropdown, setShowDropdown] = category.key === 'extractionModel' 
                ? [showExtractionModelDropdown, setShowExtractionModelDropdown]
                : category.key === 'solutionModel'
                ? [showSolutionModelDropdown, setShowSolutionModelDropdown]
                : [showDebuggingModelDropdown, setShowDebuggingModelDropdown];
              
              const modelRef = category.key === 'extractionModel' 
                ? extractionModelRef
                : category.key === 'solutionModel'
                ? solutionModelRef
                : debuggingModelRef;
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div ref={modelRef} className="relative">
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => setShowDropdown(!showDropdown)}
                    >
                      <input
                        type="text"
                        value={filteredModels.find(m => m.id === currentValue)?.name || ''}
                        readOnly
                        placeholder={`Select ${category.title.toLowerCase()}`}
                        className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                      <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    {showDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-black border border-white/10 rounded-lg shadow-lg p-4">
                        <div className="mb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                            <Input
                              type="text"
                              placeholder="Search models..."
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              className="bg-black/50 border border-white/10 text-white pl-10"
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredModels.map((m) => (
                            <div
                              key={m.id}
                              className="p-2 hover:bg-white/10 rounded cursor-pointer"
                              onClick={() => {
                                setValue(m.id);
                                setShowDropdown(false);
                              }}
                            >
                              <div className="font-medium">{m.name}</div>
                              <div className="text-xs text-white/60">{m.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
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
