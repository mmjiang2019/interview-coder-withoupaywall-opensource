import * as axios from "axios";
import { v4 as uuidv4 } from 'uuid';

// 请求状态
export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// 请求配置接口
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

// 请求结果接口
export interface RequestResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  requestId: string;
}

// 请求事件类型
type RequestEventHandler = (requestId: string, status: RequestStatus, data?: any, error?: string) => void;

// 请求管理类
export class RequestManager {
  private static instance: RequestManager;
  private requests: Map<string, {
    config: RequestConfig;
    status: RequestStatus;
    startTime: number;
    endTime?: number;
    error?: string;
    data?: any;
  }> = new Map();
  private eventHandlers: RequestEventHandler[] = [];

  private constructor() {}

  public static getInstance(): RequestManager {
    if (!RequestManager.instance) {
      RequestManager.instance = new RequestManager();
    }
    return RequestManager.instance;
  }

  /**
   * 发送请求
   */
  public async sendRequest<T = any>(config: RequestConfig): Promise<RequestResult<T>> {
    const requestId = uuidv4();
    const startTime = Date.now();

    // 记录请求
    this.requests.set(requestId, {
      config,
      status: 'pending',
      startTime
    });

    // 通知事件处理器
    this.notifyEventHandlers(requestId, 'pending');

    try {
      // 更新请求状态
      this.updateRequestStatus(requestId, 'in_progress');

      // 发送请求
      const response = await this.executeRequestWithRetry(config);

      // 更新请求状态
      this.updateRequestStatus(requestId, 'completed', response.data);

      return {
        success: true,
        data: response.data,
        status: response.status,
        requestId
      };
    } catch (error) {
      const errorMessage = this.parseError(error);
      this.updateRequestStatus(requestId, 'failed', undefined, errorMessage);

      return {
        success: false,
        error: errorMessage,
        requestId
      };
    }
  }

  /**
   * 执行请求并处理重试
   */
  private async executeRequestWithRetry(config: RequestConfig): Promise<axios.AxiosResponse> {
    const maxRetries = config.maxRetries || 3;
    const retryDelay = config.retryDelay || 1000;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await axios.default({
          url: config.url,
          method: config.method,
          headers: config.headers,
          data: config.data,
          timeout: config.timeout || 30000,
          signal: config.signal
        });
      } catch (error) {
        lastError = error;

        // 如果是取消错误，直接抛出
        if (axios.isCancel(error)) {
          throw error;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          throw error;
        }

        // 等待重试延迟
        await this.sleep(retryDelay * Math.pow(2, attempt)); // 指数退避
      }
    }

    throw lastError;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 解析错误
   */
  private parseError(error: any): string {
    if (axios.isCancel(error)) {
      return 'Request cancelled';
    }

    if (error.response) {
      // 服务器返回错误状态码
      return `Server error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`;
    } else if (error.request) {
      // 请求已发送但没有收到响应
      return 'No response received from server';
    } else {
      // 请求配置出错
      return error.message || 'Unknown error';
    }
  }

  /**
   * 更新请求状态
   */
  private updateRequestStatus(
    requestId: string,
    status: RequestStatus,
    data?: any,
    error?: string
  ): void {
    const request = this.requests.get(requestId);
    if (request) {
      this.requests.set(requestId, {
        ...request,
        status,
        data,
        error,
        endTime: status === 'completed' || status === 'failed' ? Date.now() : undefined
      });

      // 通知事件处理器
      this.notifyEventHandlers(requestId, status, data, error);
    }
  }

  /**
   * 通知事件处理器
   */
  private notifyEventHandlers(
    requestId: string,
    status: RequestStatus,
    data?: any,
    error?: string
  ): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(requestId, status, data, error);
      } catch (err) {
        console.error('Error in request event handler:', err);
      }
    });
  }

  /**
   * 获取请求状态
   */
  public getRequestStatus(requestId: string): RequestStatus | undefined {
    const request = this.requests.get(requestId);
    return request?.status;
  }

  /**
   * 获取请求详情
   */
  public getRequestDetails(requestId: string): {
    config: RequestConfig;
    status: RequestStatus;
    startTime: number;
    endTime?: number;
    duration?: number;
    error?: string;
    data?: any;
  } | undefined {
    const request = this.requests.get(requestId);
    if (!request) return undefined;

    return {
      ...request,
      duration: request.endTime ? request.endTime - request.startTime : undefined
    };
  }

  /**
   * 获取所有请求
   */
  public getAllRequests(): Array<{
    requestId: string;
    config: RequestConfig;
    status: RequestStatus;
    startTime: number;
    endTime?: number;
    duration?: number;
    error?: string;
    data?: any;
  }> {
    return Array.from(this.requests.entries()).map(([requestId, request]) => ({
      requestId,
      ...request,
      duration: request.endTime ? request.endTime - request.startTime : undefined
    }));
  }

  /**
   * 清理已完成的请求
   */
  public cleanupCompletedRequests(): void {
    const completedStatuses: RequestStatus[] = ['completed', 'failed', 'cancelled'];
    for (const [requestId, request] of this.requests.entries()) {
      if (completedStatuses.includes(request.status)) {
        this.requests.delete(requestId);
      }
    }
  }

  /**
   * 注册事件处理器
   */
  public onRequest(handler: RequestEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * 移除事件处理器
   */
  public offRequest(handler: RequestEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
  }

  /**
   * 创建 AbortController
   */
  public createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * 生成请求 ID
   */
  public generateRequestId(): string {
    return uuidv4();
  }
}

export const requestManager = RequestManager.getInstance();