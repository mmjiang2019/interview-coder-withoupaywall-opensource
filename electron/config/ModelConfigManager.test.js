// ModelConfigManager.test.js
// 简单的 JavaScript 测试文件，用于测试 ModelConfigManager 的核心功能

// 模拟 require 导入
const path = require('path');
const fs = require('fs');

// 读取并执行编译后的 JavaScript 文件
const modelConfigManagerPath = path.join(__dirname, '../../dist-electron/config/ModelConfigManager.js');

if (fs.existsSync(modelConfigManagerPath)) {
  console.log('Testing ModelConfigManager...');
  
  // 导入编译后的模块
  const { modelConfigManager } = require(modelConfigManagerPath);
  
  // 测试配置变更事件通知
  function testConfigChangeEvent() {
    console.log('\nTesting config change event...');
    
    // 注册事件监听器
    const handler = (config) => {
      console.log('Config changed:', config.apiProvider, config.language);
    };
    
    modelConfigManager.onConfigChange(handler);
    
    // 触发配置变更
    console.log('Changing API provider...');
    modelConfigManager.setApiProvider('anthropic');
    
    // 触发另一个配置变更
    console.log('Changing language...');
    modelConfigManager.setLanguage('javascript');
    
    // 移除事件监听器
    modelConfigManager.offConfigChange(handler);
    
    // 再次触发配置变更，应该不会收到通知
    console.log('Changing API key...');
    modelConfigManager.setApiKey('anthropic', 'test-api-key');
    
    console.log('Config change event test completed');
  }
  
  // 测试配置验证
  function testConfigValidation() {
    console.log('\nTesting config validation...');
    
    // 测试有效配置
    const validResult = modelConfigManager.validateConfig();
    console.log('Valid config result:', validResult.valid);
    
    // 测试无效配置（移除API密钥）
    modelConfigManager.setApiKey('anthropic', '');
    const invalidResult = modelConfigManager.validateConfig();
    console.log('Invalid config result:', invalidResult.valid, invalidResult.errors);
    
    // 恢复API密钥
    modelConfigManager.setApiKey('anthropic', 'test-api-key');
    
    console.log('Config validation test completed');
  }
  
  // 测试配置获取和更新
  function testConfigGetAndUpdate() {
    console.log('\nTesting config get and update...');
    
    // 获取当前配置
    const currentConfig = modelConfigManager.getConfig();
    console.log('Current config:', {
      apiProvider: currentConfig.apiProvider,
      language: currentConfig.language,
      extractionModel: currentConfig.extractionModel
    });
    
    // 更新配置
    const updates = {
      extractionModel: 'gpt-4o-mini',
      solutionModel: 'gpt-4o-mini',
      debuggingModel: 'gpt-4o-mini'
    };
    
    modelConfigManager.updateConfig(updates);
    
    // 获取更新后的配置
    const updatedConfig = modelConfigManager.getConfig();
    console.log('Updated config:', {
      extractionModel: updatedConfig.extractionModel,
      solutionModel: updatedConfig.solutionModel,
      debuggingModel: updatedConfig.debuggingModel
    });
    
    // 验证更新是否成功
    console.log('Extraction model updated:', updatedConfig.extractionModel === 'gpt-4o-mini');
    console.log('Solution model updated:', updatedConfig.solutionModel === 'gpt-4o-mini');
    console.log('Debugging model updated:', updatedConfig.debuggingModel === 'gpt-4o-mini');
    
    console.log('Config get and update test completed');
  }
  
  // 运行所有测试
  function runAllTests() {
    console.log('Running ModelConfigManager tests...');
    
    testConfigChangeEvent();
    testConfigValidation();
    testConfigGetAndUpdate();
    
    console.log('\nAll tests completed!');
  }
  
  // 运行测试
  runAllTests();
} else {
  console.error('ModelConfigManager.js not found. Please compile the TypeScript files first.');
  // 尝试直接测试 TypeScript 文件（使用 ts-node）
  console.log('Trying to run with ts-node...');
  const { execSync } = require('child_process');
  try {
    execSync('npx ts-node electron/config/ModelConfigManager.test.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to run with ts-node:', error.message);
  }
}