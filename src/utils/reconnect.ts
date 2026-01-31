/**
 * 重连管理模块
 * 提供指数退避重连和全局错误处理
 */
import { logger } from '../utils/logger';

export interface ReconnectionConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export type ConnectionFn = () => Promise<void>;
export type DisconnectFn = () => Promise<void>;

export class ReconnectionManager {
  private config: ReconnectionConfig;
  private retryCount: number = 0;
  private isConnected: boolean = false;
  private shouldReconnect: boolean = true;
  private connectFn: ConnectionFn;
  private disconnectFn?: DisconnectFn;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    connectFn: ConnectionFn,
    disconnectFn?: DisconnectFn,
    config?: Partial<ReconnectionConfig>
  ) {
    this.connectFn = connectFn;
    this.disconnectFn = disconnectFn;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    await this.attemptConnection();
  }

  private async attemptConnection(): Promise<void> {
    try {
      await this.connectFn();
      this.isConnected = true;
      this.retryCount = 0;
      logger.info('连接已建立');
    } catch (error) {
      this.isConnected = false;
      logger.error('连接失败', error);
      await this.scheduleReconnect();
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (!this.shouldReconnect) {
      logger.info('重连已禁用，不进行重试');
      return;
    }

    if (this.retryCount >= this.config.maxRetries) {
      logger.error('已达最大重试次数，放弃重连', { retryCount: this.retryCount });
      return;
    }

    const delay = this.calculateDelay();
    this.retryCount++;

    logger.info('计划重连', { 
      retryCount: this.retryCount, 
      delayMs: delay,
      maxRetries: this.config.maxRetries,
    });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      await this.attemptConnection();
    }, delay);
  }

  private calculateDelay(): number {
    const delay = this.config.initialDelayMs * 
      Math.pow(this.config.backoffMultiplier, this.retryCount);
    return Math.min(delay, this.config.maxDelayMs);
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.isConnected && this.disconnectFn) {
      try {
        await this.disconnectFn();
      } catch (error) {
        logger.error('断开连接时出错', error);
      }
    }

    this.isConnected = false;
    this.retryCount = 0;
    logger.info('已断开连接');
  }

  onDisconnect(): void {
    if (this.isConnected) {
      this.isConnected = false;
      logger.warn('连接丢失，计划重连');
      this.scheduleReconnect();
    }
  }

  getStatus(): { isConnected: boolean; retryCount: number } {
    return {
      isConnected: this.isConnected,
      retryCount: this.retryCount,
    };
  }
}

export function createReconnectionManager(
  connectFn: ConnectionFn,
  disconnectFn?: DisconnectFn,
  config?: Partial<ReconnectionConfig>
): ReconnectionManager {
  return new ReconnectionManager(connectFn, disconnectFn, config);
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler | null = null;
  private handlers: Array<(error: Error) => void> = [];

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  register(handler: (error: Error) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index >= 0) {
        this.handlers.splice(index, 1);
      }
    };
  }

  handle(error: Error): void {
    logger.error('全局错误', error);
    for (const handler of this.handlers) {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error('错误处理器出错', handlerError);
      }
    }
  }

  setupProcessHandlers(): void {
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常', error);
      this.handle(error);
    });

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('未处理的 Promise 拒绝', error);
      this.handle(error);
    });
  }
}

export function setupGlobalErrorHandling(): GlobalErrorHandler {
  const handler = GlobalErrorHandler.getInstance();
  handler.setupProcessHandlers();
  return handler;
}
