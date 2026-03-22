# 模型提供者和模型列表配置持久化优化计划

## 任务分解和优先级

### [ ] 任务1：修改ModelConfig接口，添加provider与模型的映射关系
- **优先级**：P0
- **依赖**：无
- **描述**：
  - 在ModelConfig接口中添加providerModels字段，用于保存每个provider对应的模型设置
  - 确保字段类型正确，包含extraction、solution、debugging三个模型字段
- **成功标准**：
  - ModelConfig接口包含providerModels字段
  - 类型定义正确，支持所有provider的模型映射
- **测试要求**：
  - `programmatic` TR-1.1：TypeScript编译无错误
  - `human-judgement` TR-1.2：接口定义清晰，符合设计要求

### [ ] 任务2：更新ModelConfigManager，实现映射关系的持久化管理
- **优先级**：P0
- **依赖**：任务1
- **描述**：
  - 更新getDefaultConfig方法，为providerModels添加默认值
  - 更新loadConfig方法，确保加载配置时处理providerModels
  - 更新setModel方法，确保更新模型时同时更新对应provider的映射关系
  - 更新setApiProvider方法，确保切换provider时加载对应的模型设置
- **成功标准**：
  - 配置加载和保存时正确处理providerModels
  - 模型更新时自动更新对应provider的映射关系
  - 切换provider时自动加载该provider的模型设置
- **测试要求**：
  - `programmatic` TR-2.1：配置持久化功能正常工作
  - `human-judgement` TR-2.2：代码逻辑清晰，符合设计要求

### [ ] 任务3：修改SettingsDialog，实现模型切换时恢复上次选择的模型
- **优先级**：P0
- **依赖**：任务2
- **描述**：
  - 更新handleProviderChange方法，从配置中获取该provider对应的模型设置
  - 更新handleSave方法，确保保存配置时也保存providerModels映射关系
  - 处理bytedance的特殊情况，确保正确访问模型列表
- **成功标准**：
  - 切换provider时自动恢复该provider上次选择的模型
  - 保存配置时正确保存providerModels映射关系
  - 界面交互流畅，无错误
- **测试要求**：
  - `programmatic` TR-3.1：界面交互正常，无TypeScript错误
  - `human-judgement` TR-3.2：用户体验良好，模型切换功能符合预期

### [ ] 任务4：测试验证模型切换功能是否正常工作
- **优先级**：P1
- **依赖**：任务3
- **描述**：
  - 启动应用程序，测试模型切换功能
  - 验证切换provider时是否恢复上次选择的模型
  - 验证配置保存和加载是否正常
- **成功标准**：
  - 切换provider时正确恢复上次选择的模型
  - 配置持久化功能正常工作
  - 应用程序运行无错误
- **测试要求**：
  - `programmatic` TR-4.1：应用程序启动正常，无运行时错误
  - `human-judgement` TR-4.2：模型切换功能符合预期，用户体验良好

## 实现细节

### 配置结构修改
- 在ModelConfig接口中添加providerModels字段：
  ```typescript
  providerModels: Record<AIProvider, {
    extraction: string;
    solution: string;
    debugging: string;
  }>;
  ```

### 代码更新
1. **ModelConfigManager.ts**：
   - 更新getDefaultConfig方法，为每个provider添加默认模型设置
   - 更新loadConfig方法，确保加载配置时处理providerModels
   - 更新setModel方法，确保更新模型时同时更新对应provider的映射关系
   - 更新setApiProvider方法，确保切换provider时加载对应的模型设置

2. **SettingsDialog.tsx**：
   - 更新handleProviderChange方法，从配置中获取该provider对应的模型设置
   - 更新handleSave方法，确保保存配置时也保存providerModels映射关系
   - 处理bytedance的特殊情况，确保正确访问模型列表

### 测试验证
- 启动应用程序，测试以下场景：
  1. 选择不同的provider，修改模型设置，保存配置
  2. 切换到其他provider，再切换回来，验证模型设置是否恢复
  3. 重启应用程序，验证配置是否正确加载

## 风险评估
- **风险1**：TypeScript类型错误 - 解决方案：仔细检查类型定义，确保类型正确
- **风险2**：配置加载错误 - 解决方案：添加错误处理，确保配置加载失败时使用默认值
- **风险3**：界面交互错误 - 解决方案：测试界面交互，确保用户体验良好

## 预期结果
- 实现模型提供者和模型列表配置的持久化优化
- 切换provider时自动恢复上次选择的模型
- 配置持久化功能正常工作
- 应用程序运行无错误
