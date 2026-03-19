// ModelSwitchManager.test.ts
// 测试 ModelSwitchManager 的核心功能

import { modelSwitchManager } from './ModelSwitchManager';
import { AIProvider } from '../clients/AIClientFactory';

// 测试切换模型提供者
async function testSwitchProvider() {
  console.log('\nTesting switchProvider...');
  
  // 注册切换事件处理器
  const switchEvents: any[] = [];
  const handler = (status: any, fromProvider: AIProvider, toProvider: AIProvider, error?: string) => {
    switchEvents.push({ status, fromProvider, toProvider, error });
    console.log(`Switch event: ${status} from ${fromProvider} to ${toProvider}`, error ? `(error: ${error})` : '');
  };
  
  modelSwitchManager.onSwitch(handler);
  
  // 测试切换到相同提供者
  const sameProviderResult = await modelSwitchManager.switchProvider('openai');
  console.log('Switch to same provider result:', sameProviderResult);
  
  // 测试切换到不同提供者
  const switchResult = await modelSwitchManager.switchProvider('anthropic');
  console.log('Switch provider result:', switchResult);
  
  // 测试强制切换
  const forceSwitchResult = await modelSwitchManager.forceSwitchProvider('openai');
  console.log('Force switch provider result:', forceSwitchResult);
  
  // 移除事件处理器
  modelSwitchManager.offSwitch(handler);
  
  console.log('Switch events count:', switchEvents.length);
  console.log('Test passed:', switchEvents.length > 0);
}

// 测试切换状态管理
function testSwitchStatus() {
  console.log('\nTesting switchStatus...');
  
  const status = modelSwitchManager.getSwitchStatus();
  console.log('Current switch status:', status);
  console.log('Test passed:', status === 'idle');
}

// 测试请求管理
function testRequestManagement() {
  console.log('\nTesting request management...');
  
  // 注册请求
  const requestId1 = 'test-request-1';
  const requestId2 = 'test-request-2';
  
  modelSwitchManager.registerRequest(requestId1);
  modelSwitchManager.registerRequest(requestId2);
  
  const pendingCount = modelSwitchManager.getPendingRequestCount();
  console.log('Pending requests count:', pendingCount);
  console.log('Test passed (after register):', pendingCount === 2);
  
  // 完成请求
  modelSwitchManager.completeRequest(requestId1);
  const pendingCountAfterComplete = modelSwitchManager.getPendingRequestCount();
  console.log('Pending requests count after complete:', pendingCountAfterComplete);
  console.log('Test passed (after complete):', pendingCountAfterComplete === 1);
  
  // 完成所有请求
  modelSwitchManager.completeRequest(requestId2);
  const pendingCountAfterAllComplete = modelSwitchManager.getPendingRequestCount();
  console.log('Pending requests count after all complete:', pendingCountAfterAllComplete);
  console.log('Test passed (after all complete):', pendingCountAfterAllComplete === 0);
}

// 运行所有测试
async function runAllTests() {
  console.log('Running ModelSwitchManager tests...');
  
  await testSwitchProvider();
  testSwitchStatus();
  testRequestManagement();
  
  console.log('\nAll tests completed!');
}

// 运行测试
runAllTests();