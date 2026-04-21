// ModelCacheManager.ts

import fs from 'fs';
import path from 'path';
import { AIProvider } from '../clients/AIClientFactory';
import { safeLogger } from '../SafeLogger';

// 模型接口
export interface CachedModel {
  id: string;
  name: string;
  description: string;
}

// 模型缓存接口
export interface ModelCache {
  models: CachedModel[];
  lastUpdated: string; // ISO datetime
  version: number; // 缓存版本号
}

export class ModelCacheManager {
  private static instance: ModelCacheManager;
  private cacheDir: string;
  private updateIntervals: Map<AIProvider, NodeJS.Timeout> = new Map();

  private constructor() {
    this.cacheDir = this.getCacheDirPath();
    this.ensureCacheDirExists();
  }

  public static getInstance(): ModelCacheManager {
    if (!ModelCacheManager.instance) {
      ModelCacheManager.instance = new ModelCacheManager();
    }
    return ModelCacheManager.instance;
  }

  private getCacheDirPath(): string {
    const appDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                         `${process.env.HOME}/Library/Application Support` : 
                         `${process.env.HOME}/.config`);
    return path.join(appDataPath, 'interview-coder-v1', 'model-cache');
  }

  private ensureCacheDirExists(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      safeLogger.mainError('Failed to create cache directory:', error);
    }
  }

  private getCacheFilePath(provider: AIProvider): string {
    return path.join(this.cacheDir, `${provider}-models.json`);
  }

  /**
   * 加载模型缓存
   */
  public loadModelCache(provider: AIProvider): ModelCache | null {
    try {
      const filePath = this.getCacheFilePath(provider);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as ModelCache;
      }
    } catch (error) {
      safeLogger.mainError(`Failed to load model cache for ${provider}:`, error);
    }
    return null;
  }

  /**
   * 保存模型缓存
   */
  public saveModelCache(provider: AIProvider, models: CachedModel[]): void {
    try {
      const cache: ModelCache = {
        models,
        lastUpdated: new Date().toISOString(),
        version: 1
      };
      const filePath = this.getCacheFilePath(provider);
      fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
      safeLogger.mainLog(`Model cache saved for ${provider}: ${models.length} models`);
    } catch (error) {
      safeLogger.mainError(`Failed to save model cache for ${provider}:`, error);
    }
  }

  /**
   * 检查缓存是否过期（超过24小时）
   */
  public isCacheExpired(provider: AIProvider): boolean {
    const cache = this.loadModelCache(provider);
    if (!cache) return true;

    const lastUpdated = new Date(cache.lastUpdated);
    const now = new Date();
    const diffInHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    return diffInHours > 24;
  }

  /**
   * 检查缓存是否为空或不存在
   */
  public isCacheEmpty(provider: AIProvider): boolean {
    const cache = this.loadModelCache(provider);
    if (!cache) return true;
    if (!cache.models || cache.models.length === 0) return true;
    return false;
  }

  /**
   * 强制刷新缓存（当缓存为空时调用）
   */
  public async forceRefreshCache(provider: AIProvider, updateFn: () => Promise<CachedModel[]>): Promise<CachedModel[]> {
    try {
      safeLogger.mainLog(`Force refreshing cache for ${provider}`);
      const newModels = await updateFn();
      if (newModels.length > 0) {
        this.saveModelCache(provider, newModels);
        safeLogger.mainLog(`Force refresh successful for ${provider}: ${newModels.length} models`);
      } else {
        safeLogger.mainLog(`Force refresh returned empty list for ${provider}`);
      }
      return newModels;
    } catch (error) {
      safeLogger.mainError(`Error force refreshing cache for ${provider}:`, error);
      return [];
    }
  }

  /**
   * 比较模型列表是否有变化
   */
  public hasModelChanges(provider: AIProvider, newModels: CachedModel[]): boolean {
    const cache = this.loadModelCache(provider);
    if (!cache) return true;

    // 简单比较模型数量
    if (cache.models.length !== newModels.length) return true;

    // 比较模型ID
    const oldModelIds = cache.models.map(m => m.id).sort();
    const newModelIds = newModels.map(m => m.id).sort();

    return JSON.stringify(oldModelIds) !== JSON.stringify(newModelIds);
  }

  /**
   * 启动定时更新任务
   */
  public startUpdateTask(provider: AIProvider, updateFn: () => Promise<CachedModel[]>): void {
    // 停止已存在的任务
    this.stopUpdateTask(provider);

    // 立即执行一次更新
    this.executeUpdateTask(provider, updateFn);

    // 设置每天执行一次的定时任务（24小时）
    const interval = setInterval(() => {
      this.executeUpdateTask(provider, updateFn);
    }, 24 * 60 * 60 * 1000);

    this.updateIntervals.set(provider, interval);
    safeLogger.mainLog(`Started model update task for ${provider}`);
  }

  /**
   * 执行更新任务
   */
  private async executeUpdateTask(provider: AIProvider, updateFn: () => Promise<CachedModel[]>): Promise<void> {
    try {
      safeLogger.mainLog(`Executing model update task for ${provider}`);
      const newModels = await updateFn();
      
      if (this.hasModelChanges(provider, newModels)) {
        this.saveModelCache(provider, newModels);
        safeLogger.mainLog(`Model cache updated for ${provider}`);
      } else {
        safeLogger.mainLog(`No changes in model list for ${provider}, skipping update`);
      }
    } catch (error) {
      safeLogger.mainError(`Error updating model cache for ${provider}:`, error);
    }
  }

  /**
   * 停止定时更新任务
   */
  public stopUpdateTask(provider: AIProvider): void {
    const interval = this.updateIntervals.get(provider);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(provider);
      safeLogger.mainLog(`Stopped model update task for ${provider}`);
    }
  }

  /**
   * 停止所有更新任务
   */
  public stopAllUpdateTasks(): void {
    for (const provider of this.updateIntervals.keys()) {
      this.stopUpdateTask(provider);
    }
  }
}

// 导出单例
export const modelCacheManager = ModelCacheManager.getInstance();
