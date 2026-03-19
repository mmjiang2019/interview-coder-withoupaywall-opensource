import { AIProvider } from '../clients/AIClientFactory';
import { modelConfigManager } from '../config/ModelConfigManager';
import { modelManager } from './ModelManager';

// 模型切换状态
export type SwitchStatus = 'idle' | 'switching' | 'completed' | 'failed';

// 模型切换事件类型
type SwitchEventHandler = (status: SwitchStatus, fromProvider: AIProvider, toProvider: AIProvider, error?: string) => void;

// 模型切换管理类
export class ModelSwitchManager {
  private static instance: ModelSwitchManager;
  private switchStatus: SwitchStatus = 'idle';
  private switchHandlers: SwitchEventHandler[] = [];
  private pendingRequests: Set<string> = new Set();
  private currentSwitch: {
    fromProvider: AIProvider;
    toProvider: AIProvider;
  } | null = null;

  private constructor() {
    // 监听配置变更，处理模型切换
    modelConfigManager.onConfigChange((config) => {
      this.handleConfigChange(config);
    });
  }

  public static getInstance(): ModelSwitchManager {
    if (!ModelSwitchManager.instance) {
      ModelSwitchManager.instance = new ModelSwitchManager();
    }
    return ModelSwitchManager.instance;
  }

  /**
   * 处理配置变更
   */
  private handleConfigChange(config: any): void {
    // 这里可以添加逻辑，当 API 提供者变更时处理切换
    console.log('Config changed, checking for provider switch...');
  }

  /**
   * 切换模型提供者
   */
  public async switchProvider(toProvider: AIProvider): Promise<boolean> {
    const fromProvider = modelConfigManager.getConfig().apiProvider;
    
    // 如果目标提供者与当前提供者相同，直接返回
    if (fromProvider === toProvider) {
      console.log(`Already using ${toProvider}, no switch needed`);
      return true;
    }

    // 如果正在切换，返回 false
    if (this.switchStatus === 'switching') {
      console.log('Already switching providers, please wait');
      return false;
    }

    // 开始切换
    this.switchStatus = 'switching';
    this.currentSwitch = { fromProvider, toProvider };
    this.notifySwitchHandlers('switching', fromProvider, toProvider);

    try {
      // 检查是否有正在进行的请求
      if (this.pendingRequests.size > 0) {
        console.log(`Waiting for ${this.pendingRequests.size} pending requests to complete...`);
        // 这里可以添加逻辑，等待所有请求完成
        // 为了简单起见，我们暂时不等待，直接切换
      }

      // 检查目标提供者的模型可用性
      const models = modelManager.getModelsByProvider(toProvider);
      if (models.length === 0) {
        throw new Error(`No models available for provider ${toProvider}`);
      }

      // 更新配置
      modelConfigManager.setApiProvider(toProvider);

      // 清除客户端缓存
      // 这里可以添加逻辑，清除所有模型提供者的客户端缓存

      // 切换完成
      this.switchStatus = 'completed';
      this.notifySwitchHandlers('completed', fromProvider, toProvider);
      this.currentSwitch = null;
      console.log(`Successfully switched from ${fromProvider} to ${toProvider}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.switchStatus = 'failed';
      this.notifySwitchHandlers('failed', fromProvider, toProvider, errorMessage);
      this.currentSwitch = null;
      console.error(`Failed to switch provider: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 注册请求
   */
  public registerRequest(requestId: string): void {
    this.pendingRequests.add(requestId);
  }

  /**
   * 完成请求
   */
  public completeRequest(requestId: string): void {
    this.pendingRequests.delete(requestId);
    
    // 如果正在切换且没有待处理的请求，继续切换
    if (this.switchStatus === 'switching' && this.pendingRequests.size === 0 && this.currentSwitch) {
      this.continueSwitch();
    }
  }

  /**
   * 继续切换
   */
  private async continueSwitch(): Promise<void> {
    if (!this.currentSwitch) return;

    const { fromProvider, toProvider } = this.currentSwitch;
    
    try {
      // 检查目标提供者的模型可用性
      const models = modelManager.getModelsByProvider(toProvider);
      if (models.length === 0) {
        throw new Error(`No models available for provider ${toProvider}`);
      }

      // 更新配置
      modelConfigManager.setApiProvider(toProvider);

      // 清除客户端缓存
      // 这里可以添加逻辑，清除所有模型提供者的客户端缓存

      // 切换完成
      this.switchStatus = 'completed';
      this.notifySwitchHandlers('completed', fromProvider, toProvider);
      this.currentSwitch = null;
      console.log(`Successfully switched from ${fromProvider} to ${toProvider}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.switchStatus = 'failed';
      this.notifySwitchHandlers('failed', fromProvider, toProvider, errorMessage);
      this.currentSwitch = null;
      console.error(`Failed to switch provider: ${errorMessage}`);
    }
  }

  /**
   * 获取切换状态
   */
  public getSwitchStatus(): SwitchStatus {
    return this.switchStatus;
  }

  /**
   * 获取待处理请求数量
   */
  public getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * 注册切换事件处理器
   */
  public onSwitch(handler: SwitchEventHandler): void {
    this.switchHandlers.push(handler);
  }

  /**
   * 移除切换事件处理器
   */
  public offSwitch(handler: SwitchEventHandler): void {
    this.switchHandlers = this.switchHandlers.filter(h => h !== handler);
  }

  /**
   * 通知切换事件处理器
   */
  private notifySwitchHandlers(status: SwitchStatus, fromProvider: AIProvider, toProvider: AIProvider, error?: string): void {
    this.switchHandlers.forEach(handler => {
      try {
        handler(status, fromProvider, toProvider, error);
      } catch (err) {
        console.error('Error in switch handler:', err);
      }
    });
  }

  /**
   * 强制切换（不等待请求完成）
   */
  public async forceSwitchProvider(toProvider: AIProvider): Promise<boolean> {
    const fromProvider = modelConfigManager.getConfig().apiProvider;
    
    // 如果目标提供者与当前提供者相同，直接返回
    if (fromProvider === toProvider) {
      console.log(`Already using ${toProvider}, no switch needed`);
      return true;
    }

    // 开始切换
    this.switchStatus = 'switching';
    this.currentSwitch = { fromProvider, toProvider };
    this.notifySwitchHandlers('switching', fromProvider, toProvider);

    try {
      // 清除待处理请求
      this.pendingRequests.clear();

      // 检查目标提供者的模型可用性
      const models = modelManager.getModelsByProvider(toProvider);
      if (models.length === 0) {
        throw new Error(`No models available for provider ${toProvider}`);
      }

      // 更新配置
      modelConfigManager.setApiProvider(toProvider);

      // 清除客户端缓存
      // 这里可以添加逻辑，清除所有模型提供者的客户端缓存

      // 切换完成
      this.switchStatus = 'completed';
      this.notifySwitchHandlers('completed', fromProvider, toProvider);
      this.currentSwitch = null;
      console.log(`Successfully switched from ${fromProvider} to ${toProvider} (forced)`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.switchStatus = 'failed';
      this.notifySwitchHandlers('failed', fromProvider, toProvider, errorMessage);
      this.currentSwitch = null;
      console.error(`Failed to switch provider: ${errorMessage}`);
      return false;
    }
  }
}

export const modelSwitchManager = ModelSwitchManager.getInstance();