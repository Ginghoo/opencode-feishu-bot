import { BaseAgent } from './base';
import type { ModelInfo, SendOptions, AnyAgentEvent } from '../types/agent';
import {
  OpencodeWrapper,
  createOpencodeWrapper,
  extractTextFromPart,
  extractToolCallFromPart,
  extractSubtaskFromPart,
  parseModelId,
  type OpencodeEventData,
} from '../opencode/client';
import { logger } from '../utils/logger';

export interface OpencodeAgentConfig {
  directory?: string;
  serverUrl?: string;
  port?: number;
  username?: string;
  password?: string;
}

export class OpencodeAgent extends BaseAgent {
  readonly id = 'opencode';
  readonly type = 'opencode';

  private wrapper: OpencodeWrapper;
  private sessionUnsubscribers = new Map<string, () => void>();
  private sessionModels = new Map<string, string>();
  private sessionProjects = new Map<string, string>();
  private sessionTokens = new Map<string, { input: number; output: number; reasoning: number; cost: number }>();

  constructor(config: OpencodeAgentConfig = {}) {
    super();
    this.wrapper = createOpencodeWrapper({
      directory: config.directory,
      serverUrl: config.serverUrl,
      port: config.port,
      username: config.username,
      password: config.password,
    });
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    await this.wrapper.start();
    this.setInitialized(true);
    logger.info('OpencodeAgent initialized');
  }

  async shutdown(): Promise<void> {
    for (const unsub of this.sessionUnsubscribers.values()) {
      unsub();
    }
    this.sessionUnsubscribers.clear();
    this.wrapper.stop();
    this.setInitialized(false);
    logger.info('OpencodeAgent shutdown');
  }

  async createSession(projectPath: string, model?: string): Promise<string> {
    this.ensureInitialized();
    const sessionId = await this.wrapper.createSession(projectPath);
    
    this.sessionProjects.set(sessionId, projectPath);
    if (model) {
      this.sessionModels.set(sessionId, model);
    }
    
    await this.setupEventSubscription(sessionId);
    
    this.notifyHandlers(sessionId, {
      type: 'session.created',
      sessionId,
      timestamp: Date.now(),
      projectPath,
      model,
    });
    
    return sessionId;
  }

  async getOrCreateSession(projectPath: string, model?: string): Promise<string> {
    return this.createSession(projectPath, model);
  }

  async switchModel(sessionId: string, model: string): Promise<void> {
    this.sessionModels.set(sessionId, model);
  }

  async clearHistory(sessionId: string): Promise<void> {
    logger.info('Clear history requested', { sessionId });
  }

  async send(sessionId: string, message: string, options?: SendOptions): Promise<void> {
    this.ensureInitialized();

    const model = this.sessionModels.get(sessionId);
    const modelSelection = model ? parseModelId(model) : undefined;
    const projectPath = this.sessionProjects.get(sessionId);

    const images = options?.images?.map(img => ({
      data: img.data,
      mimeType: img.mimeType,
      filename: img.filename,
    }));

    await this.wrapper.sendPrompt(
      sessionId,
      message,
      images,
      modelSelection ?? undefined,
      projectPath
    );
  }

  async abort(sessionId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.wrapper.abortSession(sessionId, this.sessionProjects.get(sessionId));
  }

  async executeCommand(sessionId: string, command: string): Promise<string> {
    this.ensureInitialized();
    
    if (command.startsWith('/')) {
      const [cmd, ...args] = command.slice(1).split(' ');
      const success = await this.wrapper.executeCommand(sessionId, cmd!, args.join(' '));
      return success ? 'Command executed' : 'Command failed';
    }
    
    if (command.startsWith('!')) {
      const shellCmd = command.slice(1);
      const model = this.sessionModels.get(sessionId);
      const modelSelection = model ? parseModelId(model) : undefined;
      const success = await this.wrapper.executeShell(sessionId, shellCmd, modelSelection ?? undefined);
      return success ? 'Shell command executed' : 'Shell command failed';
    }
    
    return 'Unknown command format';
  }

  async listModels(): Promise<(ModelInfo & { providerName: string })[]> {
    this.ensureInitialized();
    const models = await this.wrapper.listModels();

    return models.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.providerId,
      providerName: m.providerName,
    }));
  }

  async listSessions(): Promise<Array<{
    id: string;
    title: string;
    directory: string;
    createdAt: number;
    updatedAt: number;
  }>> {
    this.ensureInitialized();
    return this.wrapper.listSessions();
  }

  /** 切换到已有会话（恢复事件订阅） */
  async switchSession(sessionId: string, projectPath: string, model?: string): Promise<void> {
    this.ensureInitialized();

    // 清理旧订阅
    const oldUnsub = this.sessionUnsubscribers.get(sessionId);
    if (oldUnsub) {
      oldUnsub();
      this.sessionUnsubscribers.delete(sessionId);
    }

    this.sessionProjects.set(sessionId, projectPath);
    if (model) {
      this.sessionModels.set(sessionId, model);
    }

    // 为已有会话建立事件订阅
    await this.setupEventSubscription(sessionId);
  }

  async getSessionInfo(sessionId: string): Promise<{
    model?: string;
    projectPath?: string;
    messageCount?: number;
  } | null> {
    const detail = await this.wrapper.getSessionDetail(sessionId);
    if (!detail) return null;
    
    const messages = await this.wrapper.getSessionMessages(sessionId);
    
    return {
      model: this.sessionModels.get(sessionId),
      projectPath: this.sessionProjects.get(sessionId),
      messageCount: messages.length,
    };
  }

  async summarize(sessionId: string): Promise<boolean> {
    this.ensureInitialized();
    const model = this.sessionModels.get(sessionId);
    const modelSelection = model ? parseModelId(model) : undefined;
    return this.wrapper.summarizeSession(sessionId, modelSelection ?? undefined, this.sessionProjects.get(sessionId));
  }

  async replyQuestion(requestId: string, answers: string[][]): Promise<boolean> {
    return this.wrapper.replyQuestion(requestId, answers);
  }

  async rejectQuestion(requestId: string): Promise<boolean> {
    return this.wrapper.rejectQuestion(requestId);
  }

  getWrapper(): OpencodeWrapper {
    return this.wrapper;
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error('OpencodeAgent not initialized. Call initialize() first.');
    }
  }

  private async setupEventSubscription(sessionId: string): Promise<void> {
    const projectPath = this.sessionProjects.get(sessionId);
    const unsub = await this.wrapper.subscribeToEvents(sessionId, (event) => {
      this.handleOpencodeEvent(sessionId, event);
    }, projectPath);
    this.sessionUnsubscribers.set(sessionId, unsub);
    logger.debug('Event subscription set up', { sessionId, projectPath });
  }

  private handleOpencodeEvent(sessionId: string, event: OpencodeEventData): void {
    const properties = event.properties;
    const part = properties.part as Record<string, unknown> | undefined;

    switch (event.type) {
      // assistant.text / assistant.thinking：部分 provider 会发送这些事件
      case 'assistant.thinking':
        this.notifyHandlers(sessionId, {
          type: 'thinking.delta',
          sessionId,
          timestamp: Date.now(),
          delta: (part?.text as string) ?? '',
        });
        break;

      case 'assistant.text':
        this.notifyHandlers(sessionId, {
          type: 'message.delta',
          sessionId,
          timestamp: Date.now(),
          messageId: (properties.messageID as string) ?? '',
          delta: (part?.text as string) ?? '',
        });
        break;

      // message.part.delta：kimi 等 provider 通过此事件流式发送文本，只在助手回复时触发
      case 'message.part.delta': {
        const field = properties.field as string | undefined;
        const delta = properties.delta as string | undefined;
        if (field === 'text' && delta) {
          this.notifyHandlers(sessionId, {
            type: 'message.delta',
            sessionId,
            timestamp: Date.now(),
            messageId: (properties.messageID as string) ?? '',
            delta,
          });
        } else if ((field === 'reasoning' || field === 'thinking') && delta) {
          this.notifyHandlers(sessionId, {
            type: 'thinking.delta',
            sessionId,
            timestamp: Date.now(),
            delta,
          });
        }
        break;
      }

      case 'message.part.updated': {
        const partType = part?.type as string | undefined;

        // 只处理工具调用事件
        // text/thinking 由 assistant.text / assistant.thinking / message.part.delta 处理
        // message.part.updated 无法区分用户和助手消息（info 为空），因此不在此处理文本类事件
        // 提取 step-finish 中的 token 用量
        if (partType === 'step-finish') {
          const tokens = part?.tokens as { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } } | undefined;
          const cost = (part?.cost as number) ?? 0;
          if (tokens) {
            const prev = this.sessionTokens.get(sessionId) || { input: 0, output: 0, reasoning: 0, cost: 0 };
            this.sessionTokens.set(sessionId, {
              input: prev.input + (tokens.input ?? 0),
              output: prev.output + (tokens.output ?? 0),
              reasoning: prev.reasoning + (tokens.reasoning ?? 0),
              cost: prev.cost + cost,
            });
          }
        } else if (partType === 'tool-invocation' || partType === 'tool') {
          const toolInfo = extractToolCallFromPart(part);
          if (toolInfo) {
            const toolEvent: AnyAgentEvent = toolInfo.state === 'completed' || toolInfo.state === 'error'
              ? {
                  type: 'tool.complete',
                  sessionId,
                  timestamp: Date.now(),
                  toolCallId: toolInfo.name,
                  toolName: toolInfo.name,
                  success: toolInfo.state === 'completed',
                  output: toolInfo.output,
                  error: toolInfo.error,
                }
              : {
                  type: 'tool.start',
                  sessionId,
                  timestamp: Date.now(),
                  toolCallId: toolInfo.name,
                  toolName: toolInfo.name,
                  input: toolInfo.input,
                };
            this.notifyHandlers(sessionId, toolEvent);
          }
        }
        break;
      }

      case 'assistant.tool':
        const toolInfo = extractToolCallFromPart(part);
        if (toolInfo) {
          const toolEvent: AnyAgentEvent = toolInfo.state === 'completed' || toolInfo.state === 'error'
            ? {
                type: 'tool.complete',
                sessionId,
                timestamp: Date.now(),
                toolCallId: toolInfo.name,
                toolName: toolInfo.name,
                success: toolInfo.state === 'completed',
                output: toolInfo.output,
                error: toolInfo.error,
              }
            : {
                type: 'tool.start',
                sessionId,
                timestamp: Date.now(),
                toolCallId: toolInfo.name,
                toolName: toolInfo.name,
                input: toolInfo.input,
              };
          this.notifyHandlers(sessionId, toolEvent);
        }
        break;

      // message.completed 不再处理，因为 info 为空无法区分用户/助手消息
      // 完全依赖 session.idle 作为会话完成信号
      case 'session.idle': {
        const tokens = this.sessionTokens.get(sessionId);
        this.notifyHandlers(sessionId, {
          type: 'message.complete',
          sessionId,
          timestamp: Date.now(),
          messageId: (properties.messageID as string) ?? '',
          content: [],
          usage: tokens ? {
            inputTokens: tokens.input,
            outputTokens: tokens.output,
          } : undefined,
        });
        // 重置本次 token 计数（下次消息重新累计）
        this.sessionTokens.delete(sessionId);
        break;
      }

      case 'session.error':
        this.notifyHandlers(sessionId, {
          type: 'error',
          sessionId,
          timestamp: Date.now(),
          message: (properties.error as string) ?? 'Unknown error',
          recoverable: false,
        });
        break;
    }
  }
}
