import { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import {
  APIProvider,
  ModelCategoryType,
  AIModel,
  ModelCategory,
  getModelsByProviderWithCustom,
} from "../../config/models";

interface ModelSelectorProps {
  provider: APIProvider;
  category: ModelCategory;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function ModelSelector({
  provider,
  category,
  value,
  onChange,
  disabled = false,
  apiKey = "",
  accessKeyId = "",
  secretAccessKey = "",
}: ModelSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 当供应商或API key变化时，获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      // 对于ByteDance，尝试从API获取模型列表
      if (provider === "bytedance" && apiKey) {
        setIsLoading(true);
        setError(null);
        try {
          const apiModels = await window.electronAPI.getModels(provider, apiKey, accessKeyId, secretAccessKey, searchFilter);
          // 确保API返回的模型列表不为空
          if (apiModels && apiModels.length > 0) {
            setModels(apiModels);
          } else {
            setError("API returned empty model list. Using default models.");
            setModels(getModelsByProviderWithCustom(provider));
          }
        } catch (err) {
          setError("Failed to fetch models. Using default models.");
          // 出错时使用默认模型
          const defaultModels = getModelsByProviderWithCustom(provider);
          setModels(defaultModels);
        } finally {
          setIsLoading(false);
        }
      } else {
        // 对于其他供应商，使用静态配置的模型列表
        const defaultModels = getModelsByProviderWithCustom(provider);
        setModels(defaultModels);
      }
    };

    fetchModels();
  }, [provider, apiKey, accessKeyId, secretAccessKey]);

  // 根据搜索过滤模型
  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      model.description.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // 获取当前选中的模型名称
  const selectedModelName =
    models.find((m) => m.id === value)?.name || "";

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 当供应商变化时，重置搜索
  useEffect(() => {
    setSearchFilter("");
  }, [provider]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setShowDropdown(false);
    setSearchFilter("");
  };

  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-white mb-1 block">
        {category.title}
      </label>
      <p className="text-xs text-white/60 mb-2">{category.description}</p>

      <div ref={dropdownRef} className="relative">
        <div
          className={`relative ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
        >
          <input
            type="text"
            value={selectedModelName}
            readOnly
            disabled={disabled}
            placeholder={`Select ${category.title.toLowerCase()}`}
            className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <ChevronDown
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none transition-transform ${
              showDropdown ? "rotate-180" : ""
            }`}
          />
        </div>

        {showDropdown && !disabled && (
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
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 flex justify-center items-center">
                  <Loader2 className="animate-spin text-white/50 w-5 h-5" />
                  <span className="ml-2 text-white/50 text-sm">Loading models...</span>
                </div>
              ) : error ? (
                <div className="p-2 text-red-400 text-sm mb-2">
                  {error}
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="p-2 text-white/50 text-sm">
                  No models found
                </div>
              ) : (
                filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      value === model.id
                        ? "bg-white/10 border border-white/20"
                        : "hover:bg-white/10"
                    }`}
                    onClick={() => handleSelect(model.id)}
                  >
                    <div className="font-medium text-white text-sm">
                      {model.name}
                    </div>
                    <div className="text-xs text-white/60">
                      {model.description}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelSelector;
