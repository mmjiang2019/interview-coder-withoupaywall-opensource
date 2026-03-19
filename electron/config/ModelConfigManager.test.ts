import { modelConfigManager, ModelConfig } from './ModelConfigManager';

// 测试配置变更事件通知
function testConfigChangeEvent() {
  console.log('Testing config change event...');
  
  // 注册事件监听器
  const handler = (config: ModelConfig) => {
    console.log('Config changed:', config);
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
  console.log('Valid config result:', validResult);
  
  // 测试无效配置（移除API密钥）
  modelConfigManager.setApiKey('anthropic', '');
  const invalidResult = modelConfigManager.validateConfig();
  console.log('Invalid config result:', invalidResult);
  
  // 恢复API密钥
  modelConfigManager.setApiKey('anthropic', 'test-api-key');
  
  console.log('Config validation test completed');
}

// 测试配置获取和更新
function testConfigGetAndUpdate() {
  console.log('\nTesting config get and update...');
  
  // 获取当前配置
  const currentConfig = modelConfigManager.getConfig();
  console.log('Current config:', currentConfig);
  
  // 更新配置
  const updates = {
    extractionModel: 'gpt-4o-mini',
    solutionModel: 'gpt-4o-mini',
    debuggingModel: 'gpt-4o-mini'
  };
  
  modelConfigManager.updateConfig(updates);
  
  // 获取更新后的配置
  const updatedConfig = modelConfigManager.getConfig();
  console.log('Updated config:', updatedConfig);
  
  // 验证更新是否成功
  console.log('Extraction model updated:', updatedConfig.extractionModel === 'gpt-4o-mini');
  console.log('Solution model updated:', updatedConfig.solutionModel === 'gpt-4o-mini');
  console.log('Debugging model updated:', updatedConfig.debuggingModel === 'gpt-4o-mini');
  
  console.log('Config get and update test completed');
}

// 运行所有测试
function runAllTests() {
  console.log('Running ModelConfigManager tests...\n');
  
  testConfigChangeEvent();
  testConfigValidation();
  testConfigGetAndUpdate();
  
  console.log('\nAll tests completed!');
}

// 导出测试函数
if (require.main === module) {
  runAllTests();
}

export { runAllTests, testConfigChangeEvent, testConfigValidation, testConfigGetAndUpdate };