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
import {
  APIProvider,
  ModelCategoryType,
  AIModel,
  ModelCategory,
  ProviderInfo,
  providers,
  modelCategories,
  providerModelsMap,
  getModelsByProvider,
  getDefaultModel,
  getProviderInfo,
} from "../../config/models";
import { ModelSelector } from "./ModelSelector";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// 从集中配置获取供应商列表
const providerList: ProviderInfo[] = providers;

// 从集中配置获取模型类别
const categoryList: ModelCategory[] = modelCategories;

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState("");
  const [solutionModel, setSolutionModel] = useState("");
  const [debuggingModel, setDebuggingModel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
        setShowProviderDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter providers based on search input
  const filteredProviders = providerList.filter(provider => 
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



  // 设置默认模型的辅助函数
  const setDefaultModels = (provider: APIProvider) => {
    setExtractionModel(getDefaultModel(provider, "extraction"));
    setSolutionModel(getDefaultModel(provider, "solution"));
    setDebuggingModel(getDefaultModel(provider, "debugging"));
  };

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
        providerConfigs?: Record<APIProvider, {
          apiKey: string;
          extraction: string;
          solution: string;
          debugging: string;
        }>;
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
          const currentProvider = config.apiProvider || "openai";
          setApiProvider(currentProvider);
          
          // 优先从providerConfigs获取API key和模型设置
          if (config.providerConfigs && config.providerConfigs[currentProvider]) {
            const providerConfig = config.providerConfigs[currentProvider];
            setApiKey(providerConfig.apiKey || "");
            setExtractionModel(providerConfig.extraction || getDefaultModel(currentProvider, "extraction"));
            setSolutionModel(providerConfig.solution || getDefaultModel(currentProvider, "solution"));
            setDebuggingModel(providerConfig.debugging || getDefaultModel(currentProvider, "debugging"));
          } else {
            // 兼容旧格式
            setApiKey(config.apiKey || "");
            setExtractionModel(config.extractionModel || getDefaultModel(currentProvider, "extraction"));
            setSolutionModel(config.solutionModel || getDefaultModel(currentProvider, "solution"));
            setDebuggingModel(config.debuggingModel || getDefaultModel(currentProvider, "debugging"));
          }
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
          // 使用默认配置
          setDefaultModels("openai");
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
    
    // 从配置中获取该provider对应的模型设置
    window.electronAPI
      .getConfig()
      .then((config: any) => {
        // 优先使用新的providerConfigs结构
        let providerModelSettings: { extraction?: string; solution?: string; debugging?: string } = {};
        if (config.providerConfigs && config.providerConfigs[provider]) {
          providerModelSettings = config.providerConfigs[provider];
        }
        
        // 更新模型选择为该provider对应的模型设置，如果没有则使用默认模型
        setExtractionModel(providerModelSettings.extraction || getDefaultModel(provider, "extraction"));
        setSolutionModel(providerModelSettings.solution || getDefaultModel(provider, "solution"));
        setDebuggingModel(providerModelSettings.debugging || getDefaultModel(provider, "debugging"));
      })
      .catch((error: unknown) => {
        console.error("Failed to load config for provider change:", error);
        // 出错时使用默认模型
        setDefaultModels(provider);
      });
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
      
      // 直接使用旧格式更新，ModelConfigManager会处理转换
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

  // 获取当前供应商信息
  const currentProviderInfo = getProviderInfo(apiProvider);

  // 获取模型选择器的当前值
  const getModelValue = (categoryKey: string): string => {
    switch (categoryKey) {
      case 'extraction':
        return extractionModel;
      case 'solution':
        return solutionModel;
      case 'debugging':
        return debuggingModel;
      default:
        return "";
    }
  };

  // 设置模型选择器的值
  const setModelValue = (categoryKey: string, value: string) => {
    switch (categoryKey) {
      case 'extraction':
        setExtractionModel(value);
        break;
      case 'solution':
        setSolutionModel(value);
        break;
      case 'debugging':
        setDebuggingModel(value);
        break;
    }
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
                  value={currentProviderInfo?.name || ''}
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
                          handleProviderChange(provider.id);
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
              {currentProviderInfo?.name} API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={currentProviderInfo?.apiKeyPlaceholder || "Enter your API key"}
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and never sent to any server except {currentProviderInfo?.name}
            </p>
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              <p className="text-xs text-white/60 mb-1">
                1. Create an account at{' '}
                <button 
                  onClick={() => openExternalLink(currentProviderInfo?.docsUrl || '')} 
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  {currentProviderInfo?.name}
                </button>
              </p>
              <p className="text-xs text-white/60 mb-1">
                2. Go to{' '}
                <button 
                  onClick={() => openExternalLink(currentProviderInfo?.apiKeysUrl || '')} 
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  API Keys
                </button>{' '}
                section
              </p>
              <p className="text-xs text-white/60">3. Create a new secret key and paste it here</p>
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
            
            {categoryList.map((category) => (
              <ModelSelector
                key={category.key}
                provider={apiProvider}
                category={category}
                value={getModelValue(category.key)}
                onChange={(value) => setModelValue(category.key, value)}
                disabled={isLoading}
              />
            ))}
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
