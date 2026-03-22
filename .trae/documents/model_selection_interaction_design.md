# 模型供应商/模型选择交互设计文档

## 1. 设计目标

将现有的模型供应商筛选框和模型选择框合并为一个一体化的选择器，实现更直观、高效的模型选择体验。

## 2. 交互流程

### 2.1 模型供应商选择

1. **初始状态**：显示当前选择的模型供应商名称
2. **点击操作**：点击选择器，弹出下拉列表
3. **搜索功能**：在下拉列表顶部提供搜索框，可实时过滤供应商
4. **选择操作**：点击列表中的供应商，选择器显示所选供应商名称
5. **联动效果**：选择供应商后，自动更新下方模型选择器的可选项

### 2.2 模型选择

1. **初始状态**：显示当前选择的模型名称
2. **点击操作**：点击选择器，弹出下拉列表
3. **搜索功能**：在下拉列表顶部提供搜索框，可实时过滤模型
4. **选择操作**：点击列表中的模型，选择器显示所选模型名称
5. **分类展示**：模型按用途分类（问题提取、解决方案生成、调试），每个分类独立选择

## 3. 界面设计

### 3.1 模型供应商选择器

- **外观**：类似文本输入框，右侧有下拉箭头
- **内容**：显示当前选择的供应商名称
- **交互**：点击弹出下拉列表，包含搜索框和供应商列表
- **样式**：
  - 背景：黑色半透明 (#000000, 50% opacity)
  - 边框：白色半透明 (#FFFFFF, 10% opacity)
  - 文字：白色
  - 悬停效果：边框和背景透明度增加

### 3.2 模型选择器

- **外观**：类似文本输入框，右侧有下拉箭头
- **内容**：显示当前选择的模型名称
- **交互**：点击弹出下拉列表，包含搜索框和模型列表
- **样式**：与供应商选择器一致
- **分类**：按用途分为三个独立的选择器
  - 问题提取模型
  - 解决方案生成模型
  - 调试模型

## 4. 技术实现

### 4.1 组件结构

```tsx
// 模型供应商选择器组件
const ProviderSelector = ({ value, onChange, providers, searchValue, onSearchChange }) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={providers.find(p => p.id === value)?.name || ''}
        readOnly
        placeholder="Select API provider"
        className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name} - {provider.description}
          </option>
        ))}
      </select>
      <Input
        type="text"
        placeholder="Search providers..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-black/50 border border-white/10 text-white pl-10 mt-1"
      />
    </div>
  );
};

// 模型选择器组件
const ModelSelector = ({ value, onChange, models, searchValue, onSearchChange, placeholder }) => {
  return (
    <div className="relative">
      <input
        type="text"
        value={models.find(m => m.id === value)?.name || ''}
        readOnly
        placeholder={placeholder}
        className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
      />
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} - {model.description}
          </option>
        ))}
      </select>
      <Input
        type="text"
        placeholder="Search models..."
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-black/50 border border-white/10 text-white pl-10 mt-1"
      />
    </div>
  );
};
```

### 4.2 状态管理

- **供应商状态**：`apiProvider` (string)
- **供应商搜索状态**：`providerSearch` (string)
- **模型状态**：`extractionModel`, `solutionModel`, `debuggingModel` (string)
- **模型搜索状态**：每个模型分类独立的搜索状态

### 4.3 联动逻辑

```tsx
// 供应商变更处理
const handleProviderChange = (provider) => {
  setApiProvider(provider);
  
  // 重置模型到默认值
  if (provider === "openai") {
    setExtractionModel("gpt-4o");
    setSolutionModel("gpt-4o");
    setDebuggingModel("gpt-4o");
  } else if (provider === "gemini") {
    setExtractionModel("gemini-1.5-pro");
    setSolutionModel("gemini-1.5-pro");
    setDebuggingModel("gemini-1.5-pro");
  }
  // 其他供应商的默认模型设置...
};
```

## 5. 优化点

1. **视觉反馈**：添加悬停效果和选择状态指示
2. **性能优化**：使用防抖处理搜索输入，避免频繁过滤
3. **可访问性**：添加适当的ARIA标签和键盘导航支持
4. **错误处理**：当API Key无效时，禁用模型选择
5. **加载状态**：在切换供应商时显示加载指示器，特别是当需要从API获取模型列表时

## 6. 实现路径

1. **重构供应商选择器**：将搜索框和选择框合并
2. **重构模型选择器**：为每个模型分类实现相同的合并设计
3. **添加联动逻辑**：确保供应商变更时模型列表正确更新
4. **测试验证**：确保所有交互正常工作
5. **样式优化**：确保新设计与现有UI风格一致

## 7. 预期效果

- 用户可以通过一个一体化的选择器完成供应商和模型的选择
- 搜索功能与选择功能无缝集成
- 界面更加简洁，减少用户操作步骤
- 交互更加直观，提高用户体验

此设计方案将有效解决当前模型选择界面的复杂性问题，提供更加流畅的用户体验。