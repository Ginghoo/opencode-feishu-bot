import { existsSync } from 'node:fs';
import { loadConfig, getAdminUserIds, getDefaultProjectPath, getProjects, getAvailableModels, getDefaultModel, getMcpConfig } from './config';
import { parseArgs, formatHelp, getVersion, isValidLogLevel } from './cli';
import { logger, setLogLevel } from './utils/logger';
import { setupGlobalErrorHandling } from './utils/reconnect';
import { Gateway } from './gateway';
import { FeishuChannel } from './channels/feishu';
import { OpencodeAgent } from './agent/opencode';
import { createHookManager } from './hooks';
import { createPluginManager, type PluginManagerDependencies } from './plugins';
import { McpHub } from './mcp';
import { createFeishuMcpServer } from './mcp/servers/feishu';
import { createSessionManager } from './session';
import { createCommandHandler } from './commands/handler';
import { isCommand } from './commands/parser';
import { createFeishuApiClient } from './feishu/api';
import type { MessageEvent } from './types/channel';
import type { ContentBlock, ReplyStatus } from './types/message';

async function listAvailableModels(): Promise<void> {
  const agent = new OpencodeAgent({});
  try {
    await agent.initialize();
    const models = await agent.listModels();
    
    console.log('\n可用模型列表：\n');
    models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name}`);
      console.log(`     ID: ${model.id}`);
      console.log('');
    });
    console.log(`共 ${models.length} 个模型\n`);
  } finally {
    await agent.shutdown();
  }
}

async function main(): Promise<void> {
  const cliOptions = parseArgs();
  
  if (cliOptions.help) {
    console.log(formatHelp());
    process.exit(0);
  }
  
  if (cliOptions.version) {
    console.log(`v${getVersion()}`);
    process.exit(0);
  }
  
  if (cliOptions.listModels) {
    await listAvailableModels();
    process.exit(0);
  }
  
  setupGlobalErrorHandling();
  
  const logLevel = cliOptions.logLevel && isValidLogLevel(cliOptions.logLevel) 
    ? cliOptions.logLevel 
    : undefined;
  
  const config = loadConfig({
    model: cliOptions.model,
    logLevel,
  });
  setLogLevel(config.logLevel);
  
  logger.info('正在启动飞书 OpenCode 机器人...');
  
  const allProjects = getProjects(config);
  const validProjects = allProjects.filter(p => {
    if (existsSync(p.path)) return true;
    logger.warn('项目路径不存在，已跳过', { name: p.name, path: p.path });
    return false;
  });
  const projects = validProjects;
  const configuredDefault = cliOptions.project || projects[0]?.path || getDefaultProjectPath();
  const defaultProjectPath = existsSync(configuredDefault) ? configuredDefault : process.cwd();
  if (defaultProjectPath !== configuredDefault) {
    logger.warn('配置的默认项目路径不存在，已 fallback 到当前工作目录', {
      configured: configuredDefault,
      fallback: defaultProjectPath,
    });
  }
  const defaultModel = getDefaultModel(config);
  const adminUserIds = getAdminUserIds(config);
  const availableModels = getAvailableModels(config);
  
  const mcpHub = new McpHub();
  const hookManager = createHookManager();
  
  const channel = new FeishuChannel({
    appId: config.feishuAppId,
    appSecret: config.feishuAppSecret,
  });
  
  const agent = new OpencodeAgent({
    directory: defaultProjectPath,
    serverUrl: config.opencodeUrl,
    port: config.opencodePort,
    username: config.opencodeUsername,
    password: config.opencodePassword,
  });
  
  const gateway = new Gateway({
    defaultAgent: 'opencode',
    maxConcurrency: 10,
  });
  
  const sessionManager = createSessionManager(
    {
      keyType: 'chat',
      idleTimeoutMs: 30 * 60 * 1000,
      autoCompact: true,
      compactThreshold: 50,
    },
    {
      getAgent: (id) => gateway.getAgent(id),
      getChannel: (id) => gateway.getChannel(id),
      createChat: async (name, userIds) => {
        const result = await channel.createChat(name, userIds);
        return result ? { chatId: result } : null;
      },
      updateChatName: (chatId, name) => channel.updateChatName(chatId, name),
      deleteChat: (chatId) => channel.deleteChat(chatId),
    }
  );
  
  const mcpConfig = getMcpConfig(config);
  const apiClient = createFeishuApiClient(config.feishuAppId, config.feishuAppSecret);
  const feishuMcpServer = createFeishuMcpServer({
    larkClient: channel.getFeishuClient().getLarkClient(),
    apiClient,
    defaultFolderToken: config.docs?.defaultFolderToken,
    sendMessage: (chatId, text) => channel.sendTextMessage(chatId, text),
    createChat: (name, userIds) => channel.createChat(name, userIds),
  });
  
  if (mcpConfig.servers['feishu']?.enabled !== false) {
    mcpHub.registerServer(feishuMcpServer);
  }
  
  const pluginDeps: PluginManagerDependencies = {
    hookManager,
    mcpHub,
    getChannel: (id) => gateway.getChannel(id),
    getAgent: (id) => gateway.getAgent(id),
    registerChannel: (ch) => gateway.registerChannel(ch),
    registerAgent: (ag) => gateway.registerAgent(ag),
    registerMcpServer: (server) => mcpHub.registerServer(server),
  };
  
  createPluginManager({}, pluginDeps);
  
  gateway.registerChannel(channel);
  gateway.registerAgent(agent);
  
  const commandHandler = createCommandHandler(channel, agent, {
    projects,
    availableModels,
    defaultProjectPath,
    defaultModel,
    adminUserIds,
  });
  
  // 消息去重：防止飞书 WebSocket 重发导致重复处理
  const processedMessages = new Set<string>();
  const DEDUP_TTL_MS = 60_000;

  channel.on('message', async (event) => {
    const msgEvent = event as MessageEvent;
    const { chatId, senderId, content } = msgEvent;

    // 使用 messageId 去重
    const deduplicationKey = msgEvent.messageId || msgEvent.eventId || '';
    if (deduplicationKey && processedMessages.has(deduplicationKey)) {
      logger.debug('跳过重复消息', { deduplicationKey });
      return;
    }
    if (deduplicationKey) {
      processedMessages.add(deduplicationKey);
      setTimeout(() => processedMessages.delete(deduplicationKey), DEDUP_TTL_MS);
    }

    logger.debug('收到消息', { chatId, senderId, type: msgEvent.messageType });

    const text = content || '';
    
    if (isCommand(text)) {
      const result = await commandHandler.handle(text, {
        chatId,
        userId: senderId,
        isAdmin: commandHandler.isAdmin(senderId),
      });
      
      if (result.handled) {
        return;
      }
    }
    
    if (!text.trim()) {
      return;
    }
    
    try {
      const session = commandHandler.getSession(chatId, senderId);

      let sessionId = session.sessionId;
      if (!sessionId) {
        sessionId = await agent.createSession(session.projectPath, session.model);
        commandHandler.setSessionId(chatId, senderId, sessionId);
      }
      
      const initialReply = createReply('pending', [{ type: 'text', content: '正在思考...' }]);
      const messageId = await channel.sendMessage(chatId, initialReply);
      
      let fullContent = '';
      let thinkingContent = '';
      const startTime = Date.now();
      let lastUpdateTime = 0;
      let pendingUpdateTimer: ReturnType<typeof setTimeout> | null = null;
      const THROTTLE_MS = 600;

      const throttledUpdate = async () => {
        lastUpdateTime = Date.now();
        const streamingReply = createReply('streaming', [{ type: 'text', content: fullContent }], thinkingContent);
        await channel.updateMessage(messageId, streamingReply);
      };

      const unsubscribe = agent.subscribe(sessionId, async (agentEvent) => {
        try {
          switch (agentEvent.type) {
            case 'thinking.delta':
              thinkingContent += agentEvent.delta;
              break;

            case 'message.delta':
              fullContent += agentEvent.delta;
              const now = Date.now();
              if (now - lastUpdateTime >= THROTTLE_MS) {
                if (pendingUpdateTimer) {
                  clearTimeout(pendingUpdateTimer);
                  pendingUpdateTimer = null;
                }
                await throttledUpdate();
              } else if (!pendingUpdateTimer) {
                pendingUpdateTimer = setTimeout(async () => {
                  pendingUpdateTimer = null;
                  await throttledUpdate();
                }, THROTTLE_MS - (now - lastUpdateTime));
              }
              break;

            case 'message.complete':
              if (pendingUpdateTimer) {
                clearTimeout(pendingUpdateTimer);
                pendingUpdateTimer = null;
              }
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
              const usage = agentEvent.usage;
              let footer = `⏱ ${duration}s`;
              if (usage && (usage.inputTokens || usage.outputTokens)) {
                const total = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
                footer += `  |  📊 ${total.toLocaleString()} tokens (↑${(usage.inputTokens ?? 0).toLocaleString()} ↓${(usage.outputTokens ?? 0).toLocaleString()})`;
              }
              if (session.model) {
                const modelName = session.model.split('/').pop() ?? session.model;
                footer += `  |  🤖 ${modelName}`;
              }
              const completeReply = createReply('completed', [{ type: 'text', content: fullContent + `\n\n---\n${footer}` }], thinkingContent);
              await channel.updateMessage(messageId, completeReply);
              unsubscribe();
              break;

            case 'error':
              if (pendingUpdateTimer) {
                clearTimeout(pendingUpdateTimer);
                pendingUpdateTimer = null;
              }
              const errorReply = createReply('error', [{ type: 'error', message: agentEvent.message }]);
              await channel.updateMessage(messageId, errorReply);
              unsubscribe();
              break;
          }
        } catch (updateError) {
          logger.error('更新消息失败', { error: updateError });
        }
      });
      
      await agent.send(sessionId, text);
      
    } catch (error) {
      logger.error('处理消息失败', { chatId, error });
      await channel.sendTextMessage(chatId, `处理消息时出错: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });
  
  await gateway.start();
  
  const opencodeUrl = agent.getWrapper().getServerUrl();
  
  logger.info('飞书 OpenCode 机器人启动成功');
  logger.info('配置信息', {
    appId: config.feishuAppId.substring(0, 8) + '...',
    opencodeUrl,
    defaultProject: defaultProjectPath,
    defaultModel: defaultModel || '(未设置)',
    adminCount: adminUserIds.length,
  });

  // 发送启动通知（延迟 2s 确保飞书 WebSocket 完全就绪）
  if (config.notifyUserId) {
    const sendStartupNotification = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isExternal = !!config.opencodeUrl;
      const skippedProjects = allProjects.length - validProjects.length;
      const projectInfo = skippedProjects > 0
        ? `\`${defaultProjectPath}\` (${skippedProjects} 个配置路径不存在)`
        : `\`${defaultProjectPath}\``;
      const statusCard = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: 'OpenCode Bot 已启动' },
          template: 'green',
        },
        elements: [
          {
            tag: 'markdown',
            content: [
              `**服务状态：** 运行中`,
              `**OpenCode：** ${isExternal ? `已连接桌面应用 (${opencodeUrl})` : `独立服务 (${opencodeUrl})`}`,
              `**默认项目：** ${projectInfo}`,
              `**可用项目：** ${validProjects.length > 0 ? validProjects.map(p => p.name).join(', ') : '(无)'}`,
              `**默认模型：** \`${defaultModel || '未设置'}\``,
              `**启动时间：** ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
            ].join('\n'),
          },
          {
            tag: 'note',
            elements: [{ tag: 'plain_text', content: '发送 /help 查看可用命令 | /status 查看会话状态' }],
          },
        ],
      };
      try {
        await channel.sendCardToUser(config.notifyUserId, statusCard);
        logger.info('已发送启动通知', { userId: config.notifyUserId });
      } catch (err) {
        logger.warn('发送启动通知失败', { error: err });
      }
    };
    sendStartupNotification();
  } else {
    logger.info('未配置 notify_user_id，跳过启动通知');
  }
  
  const shutdown = async (signal: string) => {
    logger.info(`收到 ${signal} 信号，正在关闭...`);
    
    sessionManager.shutdown();
    await gateway.stop();
    hookManager.clear();
    
    logger.info('关闭完成');
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function createReply(status: ReplyStatus, blocks: ContentBlock[], thinking?: string): {
  status: ReplyStatus;
  blocks: ContentBlock[];
  showThinking?: boolean;
} {
  const result: { status: ReplyStatus; blocks: ContentBlock[]; showThinking?: boolean } = {
    status,
    blocks,
  };
  
  if (thinking) {
    result.blocks = [{ type: 'thinking', content: thinking }, ...blocks];
    result.showThinking = true;
  }
  
  return result;
}

main().catch((error) => {
  logger.error('致命错误', error);
  process.exit(1);
});
