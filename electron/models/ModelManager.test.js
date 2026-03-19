// ModelManager.test.js
// 测试 ModelManager 的核心功能

const path = require('path');
const fs = require('fs');

// 读取并执行编译后的 JavaScript 文件
const modelManagerPath = path.join(__dirname, '../../dist-electron/models/ModelManager.js');

if (fs.existsSync(modelManagerPath)) {
  console.log('Testing ModelManager...');
  
  // 导入编译后的模块
  const { modelManager } = require(modelManagerPath);
  
  // 测试获取模型元数据
  function testGetModelMetadata() {
    console.log('\nTesting getModelMetadata...');
    
    const modelId = 'openai-gpt-4o';
    const model = modelManager.getModelMetadata(modelId);
    console.log('Model metadata:', model);
    console.log('Test passed:', !!model);
  }
  
  // 测试获取指定提供者的模型
  function testGetModelsByProvider() {
    console.log('\nTesting getModelsByProvider...');
    
    const models = modelManager.getModelsByProvider('openai');
    console.log('OpenAI models count:', models.length);
    console.log('Test passed:', models.length > 0);
  }
  
  // 测试获取指定类型的模型
  function testGetModelsByType() {
    console.log('\nTesting getModelsByType...');
    
    const models = modelManager.getModelsByType('extraction');
    console.log('Extraction models count:', models.length);
    console.log('Test passed:', models.length > 0);
  }
  
  // 测试获取当前提供者的模型
  function testGetCurrentProviderModels() {
    console.log('\nTesting getCurrentProviderModels...');
    
    const models = modelManager.getCurrentProviderModels();
    console.log('Current provider models count:', models.length);
    console.log('Test passed:', models.length > 0);
  }
  
  // 测试获取推荐模型
  function testGetRecommendedModel() {
    console.log('\nTesting getRecommendedModel...');
    
    const model = modelManager.getRecommendedModel('extraction');
    console.log('Recommended model:', model);
    console.log('Test passed:', !!model);
  }
  
  // 测试检查模型可用性
  async function testCheckModelAvailability() {
    console.log('\nTesting checkModelAvailability...');
    
    const modelId = 'openai-gpt-4o';
    const isAvailable = await modelManager.checkModelAvailability(modelId);
    console.log('Model availability:', isAvailable);
    console.log('Test passed:', isAvailable === true);
  }
  
  // 测试批量检查模型可用性
  async function testCheckModelsAvailability() {
    console.log('\nTesting checkModelsAvailability...');
    
    const modelIds = ['openai-gpt-4o', 'anthropic-claude-3-opus'];
    const results = await modelManager.checkModelsAvailability(modelIds);
    console.log('Models availability:', Object.fromEntries(results));
    console.log('Test passed:', results.size === modelIds.length);
  }
  
  // 测试添加自定义模型
  function testAddCustomModel() {
    console.log('\nTesting addCustomModel...');
    
    const customModel = {
      id: 'custom-model-1',
      name: 'custom-model',
      provider: 'openai',
      type: 'extraction',
      description: 'Custom test model',
      capabilities: ['text', 'code'],
      version: '1.0',
      isAvailable: true,
      lastChecked: new Date()
    };
    
    modelManager.addCustomModel(customModel);
    const addedModel = modelManager.getModelMetadata('custom-model-1');
    console.log('Added model:', addedModel);
    console.log('Test passed:', !!addedModel);
  }
  
  // 测试更新模型元数据
  function testUpdateModelMetadata() {
    console.log('\nTesting updateModelMetadata...');
    
    modelManager.updateModelMetadata('openai-gpt-4o', {
      description: 'Updated description for GPT-4o'
    });
    
    const updatedModel = modelManager.getModelMetadata('openai-gpt-4o');
    console.log('Updated model description:', updatedModel.description);
    console.log('Test passed:', updatedModel.description.includes('Updated'));
  }
  
  // 测试删除模型
  function testRemoveModel() {
    console.log('\nTesting removeModel...');
    
    modelManager.removeModel('custom-model-1');
    const removedModel = modelManager.getModelMetadata('custom-model-1');
    console.log('Removed model exists:', !!removedModel);
    console.log('Test passed:', !removedModel);
  }
  
  // 测试获取模型能力
  function testGetModelCapabilities() {
    console.log('\nTesting getModelCapabilities...');
    
    const capabilities = modelManager.getModelCapabilities('openai-gpt-4o');
    console.log('Model capabilities:', capabilities);
    console.log('Test passed:', capabilities.length > 0);
  }
  
  // 测试检查模型能力
  function testModelSupportsCapability() {
    console.log('\nTesting modelSupportsCapability...');
    
    const supportsText = modelManager.modelSupportsCapability('openai-gpt-4o', 'text');
    const supportsImage = modelManager.modelSupportsCapability('openai-gpt-4o', 'image');
    const supportsAudio = modelManager.modelSupportsCapability('openai-gpt-4o', 'audio');
    
    console.log('Supports text:', supportsText);
    console.log('Supports image:', supportsImage);
    console.log('Supports audio:', supportsAudio);
    console.log('Test passed:', supportsText && supportsImage && !supportsAudio);
  }
  
  // 运行所有测试
  async function runAllTests() {
    console.log('Running ModelManager tests...');
    
    testGetModelMetadata();
    testGetModelsByProvider();
    testGetModelsByType();
    testGetCurrentProviderModels();
    testGetRecommendedModel();
    await testCheckModelAvailability();
    await testCheckModelsAvailability();
    testAddCustomModel();
    testUpdateModelMetadata();
    testRemoveModel();
    testGetModelCapabilities();
    testModelSupportsCapability();
    
    console.log('\nAll tests completed!');
  }
  
  // 运行测试
  runAllTests();
} else {
  console.error('ModelManager.js not found. Please compile the TypeScript files first.');
  // 尝试直接测试 TypeScript 文件（使用 ts-node）
  console.log('Trying to run with ts-node...');
  const { execSync } = require('child_process');
  try {
    execSync('npx ts-node electron/models/ModelManager.test.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to run with ts-node:', error.message);
  }
}