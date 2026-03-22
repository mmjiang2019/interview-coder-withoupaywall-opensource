# 动态添加 Model Provider 实现方案

## 项目现状分析

### 现有架构
- **ModelProviderRegistry**：管理所有模型提供者的注册和获取
- **ModelProvider 接口**：定义模型提供者的基本方法和属性
- **BaseModelProvider**：提供基础实现，包括客户端缓存和响应解析
- **现有提供者**：OpenAI、Gemini、Anthropic、Ollama、ByteDance
- **配置管理**：ModelConfigManager 负责配置的保存和加载
- **前端设置**：SettingsDialog 提供API提供者选择和模型配置

### 需求分析
用户需要在服务页面上：
1. 动态添加新的 model provider
2. 配置对应的 API key
3. 配置 URL 连接
4. 通过请求接口动态查询当前所有模型列表
5. 根据用户选择目标模型

## 实现方案

### 1. 核心数据结构扩展

#### 1.1 扩展 ModelConfig 接口
- 添加自定义提供者配置
- 支持 URL 配置
- 支持动态模型列表

#### 1.2 扩展 ModelProvider 接口
- 添加获取模型列表的方法
- 添加 URL 配置支持

### 2. 后端实现

#### 2.1 ModelConfigManager 扩展
- 支持自定义提供者配置的保存和加载
- 提供获取和更新自定义提供者的方法

#### 2.2 ModelProviderRegistry 扩展
- 支持运行时注册和管理自定义提供者
- 提供动态创建提供者实例的能力

#### 2.3 动态 Provider 实现
- 创建 GenericProvider 类，支持通过配置创建通用提供者
- 支持动态 URL 和模型列表查询

#### 2.4 IPC 处理扩展
- 添加获取自定义提供者列表的接口
- 添加添加/删除自定义提供者的接口
- 添加查询模型列表的接口

### 3. 前端实现

#### 3.1 SettingsDialog 扩展
- 添加 "添加自定义提供者" 功能
- 支持配置提供者名称、API key、URL
- 支持动态查询和选择模型
- 显示所有提供者（内置 + 自定义）

#### 3.2 模型选择优化
- 动态加载模型列表
- 支持模型搜索和过滤
- 显示模型详情和状态

### 4. 数据流程

1. **添加自定义提供者**：
   - 前端填写提供者信息（名称、API key、URL）
   - 后端验证并创建提供者实例
   - 注册到 ModelProviderRegistry
   - 保存配置到 ModelConfigManager

2. **查询模型列表**：
   - 前端请求指定提供者的模型列表
   - 后端调用提供者的 getModels 方法
   - 提供者通过 API 请求获取模型列表
   - 返回模型列表到前端

3. **选择模型**：
   - 前端选择模型
   - 后端更新配置
   - 应用新的模型配置

## 详细任务分解

### 任务 1：扩展核心数据结构
- **优先级**：P0
- **依赖**：无
- **描述**：
  - 扩展 ModelConfig 接口，添加自定义提供者支持
  - 扩展 ModelProvider 接口，添加获取模型列表方法
- **成功标准**：
  - 数据结构能够支持自定义提供者和动态模型列表
- **测试要求**：
  - 编译通过，类型检查无错误

### 任务 2：实现 GenericProvider
- **优先级**：P0
- **依赖**：任务 1
- **描述**：
  - 创建 GenericProvider 类，支持动态配置
  - 实现 getModels 方法，通过 API 查询模型列表
  - 实现核心方法（extractProblemInfo、generateSolution、debugCode）
- **成功标准**：
  - GenericProvider 能够正确处理 API 请求
  - 能够获取和返回模型列表
- **测试要求**：
  - 单元测试通过
  - 能够正确处理 API 响应

### 任务 3：扩展 ModelConfigManager
- **优先级**：P0
- **依赖**：任务 1
- **描述**：
  - 添加自定义提供者配置的保存和加载
  - 提供管理自定义提供者的方法
- **成功标准**：
  - 配置能够正确保存和加载
  - 自定义提供者配置持久化
- **测试要求**：
  - 配置保存和加载测试通过

### 任务 4：扩展 ModelProviderRegistry
- **优先级**：P0
- **依赖**：任务 1、任务 2
- **描述**：
  - 支持运行时注册自定义提供者
  - 提供动态创建提供者实例的能力
- **成功标准**：
  - 能够动态注册和获取自定义提供者
- **测试要求**：
  - 注册和获取测试通过

### 任务 5：扩展 IPC 处理
- **优先级**：P1
- **依赖**：任务 3、任务 4
- **描述**：
  - 添加获取自定义提供者列表的接口
  - 添加添加/删除自定义提供者的接口
  - 添加查询模型列表的接口
- **成功标准**：
  - 所有 IPC 接口能够正常工作
- **测试要求**：
  - IPC 接口测试通过

### 任务 6：扩展前端 SettingsDialog
- **优先级**：P1
- **依赖**：任务 5
- **描述**：
  - 添加 "添加自定义提供者" 功能
  - 支持配置提供者信息
  - 支持动态查询和选择模型
- **成功标准**：
  - 前端能够添加和配置自定义提供者
  - 能够显示和选择动态模型列表
- **测试要求**：
  - UI 功能测试通过
  - 与后端交互测试通过

### 任务 7：测试和优化
- **优先级**：P2
- **依赖**：所有任务
- **描述**：
  - 端到端测试
  - 性能优化
  - 错误处理和用户体验优化
- **成功标准**：
  - 所有功能正常工作
  - 性能满足要求
  - 用户体验良好
- **测试要求**：
  - 端到端测试通过
  - 性能测试通过

## 技术实现细节

### 数据结构扩展

**ModelConfig 扩展**：
```typescript
interface CustomProvider {
  name: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  apiKeyPattern: string;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };
}

interface ModelConfig {
  // 现有字段...
  customProviders: CustomProvider[];
}
```

**ModelProvider 扩展**：
```typescript
interface ModelProvider {
  // 现有方法...
  getModels(apiKey: string): Promise<Array<{ id: string; name: string; description: string }>>;
  baseUrl?: string;
}
```

### GenericProvider 实现

```typescript
export class GenericProvider extends BaseModelProvider {
  name: string;
  displayName: string;
  apiKeyPattern: RegExp;
  baseUrl: string;
  defaultModels: {
    extraction: string;
    solution: string;
    debugging: string;
  };

  constructor(config: {
    name: string;
    displayName: string;
    apiKeyPattern: string;
    baseUrl: string;
    defaultModels: {
      extraction: string;
      solution: string;
      debugging: string;
    };
  }) {
    super();
    this.name = config.name;
    this.displayName = config.displayName;
    this.apiKeyPattern = new RegExp(config.apiKeyPattern);
    this.baseUrl = config.baseUrl;
    this.defaultModels = config.defaultModels;
  }

  async getModels(apiKey: string): Promise<Array<{ id: string; name: string; description: string }>> {
    // 通过 API 请求获取模型列表
    // 实现具体的 API 调用逻辑
  }

  // 实现其他核心方法...
}
```

### 前端实现

**添加自定义提供者表单**：
- 提供者名称
- 显示名称
- API Key
- Base URL
- API Key 正则表达式
- 默认模型配置

**模型列表查询**：
- 选择提供者后自动查询模型列表
- 显示模型名称和描述
- 支持搜索和过滤

## 风险和挑战

1. **API 兼容性**：不同提供者的 API 格式可能不同
2. **错误处理**：需要处理各种 API 错误和网络问题
3. **性能优化**：模型列表查询可能较慢，需要缓存机制
4. **用户体验**：需要提供清晰的错误提示和加载状态

## 解决方案

1. **API 兼容性**：
   - 定义标准化的 API 接口
   - 提供适配器模式处理不同 API 格式

2. **错误处理**：
   - 实现统一的错误处理机制
   - 提供详细的错误提示

3. **性能优化**：
   - 实现模型列表缓存
   - 异步加载模型列表

4. **用户体验**：
   - 添加加载状态指示器
   - 提供清晰的错误提示
   - 优化表单验证

## 预期成果

- 用户能够在设置页面添加自定义模型提供者
- 能够配置 API key 和 URL 连接
- 能够动态查询和选择模型
- 所有功能能够正常工作且性能良好
- 用户体验流畅，错误处理完善