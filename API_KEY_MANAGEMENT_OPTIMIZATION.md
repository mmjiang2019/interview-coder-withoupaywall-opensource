# API Key 管理功能优化文档

## 问题分析

当前应用在模型切换时存在以下问题：
1. 切换模型供应商时，用户需要重新输入对应模型的API key
2. 没有有效的API key配置管理机制
3. 用户体验较差，需要重复输入API key

## 功能优化目标

根据用户需求，优化后的系统应实现以下功能：
1. **选择bytedance模型**：输入API key，成功完成模型注册
2. **切换到zhupu模型**：
   - 如果配置中没有zhupu API key，提示用户输入
   - 如果配置中已有zhupu API key，自动填入API key填充框
   - 用户可选择更新API key
   - 保存后，模型应能正常注册
3. **后续切换**：无论如何切换bytedance和zhupu，用户无需重新输入API key
4. **配置管理**：实现模型供应商及相关API key的配置管理

## 技术实现方案

### 1. 配置管理改进

#### ModelConfigManager.ts
- 确保`apiKeys`对象包含所有支持的模型供应商
- 提供API key的存储和获取方法
- 实现配置的持久化存储

### 2. UI交互改进

#### SettingsDialog.tsx
- 实现API key的自动加载逻辑
- 优化模型切换时的API key处理
- 确保API key的正确保存和更新

### 3. IPC通信改进

#### ipcHandlers.ts
- 确保get-config返回所有API key
- 确保update-config正确处理API key的更新

## 实现细节

### 1. 配置管理

**ModelConfigManager.ts**
- 定义`apiKeys`为`Record<AIProvider, string>`类型
- 在默认配置中初始化所有支持的模型供应商的API key
- 提供`setApiKey`方法更新单个供应商的API key
- 提供`updateConfig`方法批量更新配置

### 2. UI交互

**SettingsDialog.tsx**
- 维护`apiKeys`状态，存储所有供应商的API key
- 在组件加载时从配置中获取所有API key
- 实现`handleProviderChange`方法，切换供应商时自动加载对应的API key
- 实现`handleSave`方法，保存当前供应商的API key到`apiKeys`对象中

### 3. IPC通信

**ipcHandlers.ts**
- 在`get-config`中返回所有API key
- 在`update-config`中处理`apiKeys`的更新
- 确保API key的正确存储和加载

## 测试计划

### 测试场景

1. **场景1：首次配置bytedance模型**
   - 打开设置对话框
   - 选择bytedance模型
   - 输入API key
   - 保存配置
   - 验证API key是否正确保存

2. **场景2：切换到zhupu模型**
   - 打开设置对话框
   - 切换到zhupu模型
   - 验证API key输入框是否为空（首次切换）
   - 输入zhupu API key
   - 保存配置
   - 验证API key是否正确保存

3. **场景3：再次切换回bytedance模型**
   - 打开设置对话框
   - 切换回bytedance模型
   - 验证API key是否自动填充
   - 保存配置
   - 验证模型是否正常注册

4. **场景4：多次切换模型**
   - 多次切换bytedance和zhupu模型
   - 验证每次切换时API key是否正确加载
   - 验证模型是否正常注册

### 测试步骤

1. 启动应用
2. 打开设置对话框
3. 执行测试场景1-4
4. 验证每个场景的结果
5. 检查配置文件是否正确更新

## 预期结果

1. 用户只需输入一次每个模型供应商的API key
2. 切换模型时，系统自动加载对应供应商的API key
3. 模型注册过程顺利完成，无需重复输入API key
4. 配置持久化存储，重启应用后仍然有效

## 技术风险评估

1. **风险**：API key存储安全
   **缓解措施**：API key存储在本地配置文件中，不发送到任何服务器

2. **风险**：配置文件损坏
   **缓解措施**：实现配置文件的错误处理，损坏时使用默认配置

3. **风险**：API key格式验证
   **缓解措施**：在保存前验证API key格式

## 结论

通过以上优化方案，应用将实现API key的自动管理，提升用户体验，减少重复操作，确保模型切换的顺畅性。