import type { FeishuClient, BotAddedEvent, MessageRecalledEvent, BotRemovedEvent, BotMenuEvent, UserLeftChatEvent, ChatDisbandedEvent, CardActionEvent } from '../feishu/client';
import type { SessionManager } from '../session/manager';
import type { OpencodeWrapper } from '../opencode/client';
import type { ProjectConfig, ModelConfig } from '../config';
import { filterModels } from '../config';
import { createWelcomeCard, type BotInfo } from '../feishu/welcome';
import { 
  createProjectSelectCard, 
  createModelSelectCard, 
  createStatusCard, 
  createSuccessCard, 
  createErrorCard,
  createSessionChatCreatedCard,
  createSessionChatWelcomeCard,
  createProjectSwitchedCard,
  type SessionStatus,
  type ModelInfo 
} from '../feishu/menu';
import { createQuestionErrorCard } from '../feishu/question-card';
import { logger } from '../utils/logger';

export interface EventHandlerConfig {
  feishuClient: FeishuClient;
  sessionManager: SessionManager;
  opencodeClient: OpencodeWrapper;
  projects: ProjectConfig[];
  availableModels: ModelConfig[];
}

export function setupEventHandlers(config: EventHandlerConfig): void {
  const { feishuClient, sessionManager, opencodeClient, projects, availableModels } = config;
  
  const getFilteredModels = async (): Promise<ModelInfo[]> => {
    const allModels = await opencodeClient.listModels();
    const mapped = allModels.map(m => ({ id: m.id, name: m.name }));
    return filterModels(mapped, availableModels);
  };

  feishuClient.onBotAdded(async (event: BotAddedEvent) => {
    logger.info('机器人被添加到群聊', { chatId: event.chatId, chatName: event.chatName });

    const botInfo: BotInfo = {
      projectPath: sessionManager.getDefaultProjectPath(),
      activeSessionCount: sessionManager.getActiveSessionCount(),
    };

    const card = createWelcomeCard(botInfo, event.chatName);
    await feishuClient.sendCard(event.chatId, card);
  });

  feishuClient.onMessageRecalled(async (event: MessageRecalledEvent) => {
    logger.info('消息被撤回', { messageId: event.messageId, chatId: event.chatId });

    const result = await sessionManager.handleMessageRecall(event.messageId);
    
    if (result.aborted || result.botMessagesDeleted > 0) {
      logger.info('撤回处理完成', { ...result, messageId: event.messageId });
    }
  });

  feishuClient.onBotRemoved(async (event: BotRemovedEvent) => {
    logger.info('机器人被移出群聊', { chatId: event.chatId });
    
    const sessionChat = sessionManager.getSessionChat(event.chatId);
    if (sessionChat) {
      await sessionManager.cleanupSessionChat(event.chatId);
    } else {
      sessionManager.cleanupChatData(event.chatId);
    }
  });

  feishuClient.onUserLeftChat(async (event: UserLeftChatEvent) => {
    logger.info('用户退出群聊', { chatId: event.chatId, users: event.users });
    
    await sessionManager.handleUserLeftSessionChat(event.chatId);
  });

  feishuClient.onChatDisbanded(async (event: ChatDisbandedEvent) => {
    logger.info('群聊被解散', { chatId: event.chatId });
    
    await sessionManager.cleanupSessionChat(event.chatId);
  });

  feishuClient.onBotMenu(async (event: BotMenuEvent) => {
    logger.info('菜单点击', { eventKey: event.eventKey, operatorId: event.operatorId });
    
    const userId = event.operatorId;
    if (!userId) {
      logger.warn('菜单事件缺少操作者 ID');
      return;
    }

    try {
      switch (event.eventKey) {
        case 'new_session': {
          if (projects.length === 0) {
            const defaultPath = sessionManager.getDefaultProjectPath();
            
            const loadingCard = createSuccessCard('正在创建...', '正在创建会话群，请稍候...');
            const loadingMsgId = await feishuClient.sendCardToUser(userId, loadingCard);
            
            const result = await sessionManager.createSessionChat(userId, defaultPath);
            
            if (result) {
              const models = await getFilteredModels();
              const welcomeCard = createSessionChatWelcomeCard({
                sessionId: result.sessionId,
                projectPath: defaultPath,
                projects: projects,
                chatId: result.chatId,
                models: models,
              });
              await feishuClient.sendCard(result.chatId, welcomeCard);
              
              const successCard = createSessionChatCreatedCard(result.chatId, result.sessionId, defaultPath);
              if (loadingMsgId) {
                await feishuClient.updateCard(loadingMsgId, successCard);
              } else {
                await feishuClient.sendCardToUser(userId, successCard);
              }
            } else {
              const errorCard = createErrorCard('创建失败', '创建会话群时发生错误，请稍后重试');
              if (loadingMsgId) {
                await feishuClient.updateCard(loadingMsgId, errorCard);
              } else {
                await feishuClient.sendCardToUser(userId, errorCard);
              }
            }
            break;
          }
          
          if (event.chatId) {
            const sessionChat = sessionManager.getSessionChat(event.chatId);
            if (sessionChat) {
              const card = createProjectSelectCard(projects, '切换项目后将创建新会话');
              await feishuClient.sendMessage(event.chatId, JSON.stringify(card), 'interactive');
            } else {
              const card = createProjectSelectCard(projects);
              await feishuClient.sendCardToUser(userId, card);
            }
          } else {
            const card = createProjectSelectCard(projects);
            await feishuClient.sendCardToUser(userId, card);
          }
          break;
        }
        
        case 'switch_model': {
          const models = await getFilteredModels();
          const card = createModelSelectCard(models);
          
          if (event.chatId) {
            await feishuClient.sendCard(event.chatId, card);
          } else {
            await feishuClient.sendCardToUser(userId, card);
          }
          break;
        }
        
        case 'compact': {
          const sessionId = await sessionManager.getOrCreateUserSession(userId);
          if (sessionId) {
            const success = await opencodeClient.executeCommand(sessionId, 'compact');
            const card = success 
              ? createSuccessCard('压缩上下文', '上下文已成功压缩')
              : createErrorCard('压缩失败', '执行 compact 命令时发生错误');
            await feishuClient.sendCardToUser(userId, card);
          }
          break;
        }
        
        case 'clear_history': {
          await sessionManager.createNewUserSession(userId);
          const card = createSuccessCard('清除历史', '会话历史已清除，已创建新会话');
          await feishuClient.sendCardToUser(userId, card);
          break;
        }
        
        case 'show_status': {
          const session = await sessionManager.getUserSessionInfo(userId);
          if (session) {
            const status: SessionStatus = {
              sessionId: session.sessionId,
              projectPath: session.projectPath,
              isActive: session.isActive,
            };
            const card = createStatusCard(status);
            await feishuClient.sendCardToUser(userId, card);
          } else {
            const card = createErrorCard('无会话', '当前没有活跃的会话');
            await feishuClient.sendCardToUser(userId, card);
          }
          break;
        }
        
        case 'show_cost': {
          const card = createErrorCard('功能开发中', '费用统计功能正在开发中');
          await feishuClient.sendCardToUser(userId, card);
          break;
        }
        
        default:
          logger.warn('未知的菜单事件', { eventKey: event.eventKey });
      }
    } catch (error) {
      logger.error('处理菜单事件时出错', error);
      const card = createErrorCard('操作失败', `处理菜单操作时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
      await feishuClient.sendCardToUser(userId, card);
    }
  });

  feishuClient.onCardAction(async (event: CardActionEvent) => {
    const actionType = event.action.value?.action as string | undefined;
    logger.info('卡片交互', { action: actionType, operatorId: event.operatorId });

    if (!event.operatorId) {
      logger.warn('卡片交互事件缺少操作者 ID');
      return;
    }

    try {
      switch (actionType) {
        case 'switch_model': {
          const modelId = event.action.option;
          if (!modelId) {
            logger.warn('切换模型未选择模型');
            return;
          }

          const chatId = event.chatId;
          if (!chatId) {
            logger.warn('切换模型缺少 chatId');
            return;
          }

          const sessionChat = sessionManager.getSessionChat(chatId);
          let sessionId: string | null = null;
          
          if (sessionChat) {
            sessionId = sessionChat.session_id;
          } else {
            sessionId = await sessionManager.getOrCreateUserSession(event.operatorId);
          }
          
          if (!sessionId) {
            logger.error('获取会话失败');
            return;
          }

          const success = await opencodeClient.executeCommand(sessionId, 'model', modelId);
          
          if (event.messageId) {
            const card = success
              ? createSuccessCard('切换成功', `已切换到模型：\`${modelId}\``)
              : createErrorCard('切换失败', '切换模型时发生错误');
            await feishuClient.updateCard(event.messageId, card);
          }
          break;
        }

        case 'question_answer': {
          const chatId = event.chatId;
          if (!chatId) {
            logger.warn('问题回答缺少 chatId');
            return;
          }

          const { requestId, questionIndex, answerLabel } = event.action.value as {
            requestId?: string;
            questionIndex?: number;
            answerLabel?: string;
          };

          const selectedOption = event.action.option || answerLabel;
          
          if (!requestId || questionIndex === undefined || !selectedOption) {
            logger.warn('问题回答缺少必要参数', { requestId, questionIndex, selectedOption });
            return;
          }

          const success = await sessionManager.handleQuestionAnswer(
            chatId,
            requestId,
            questionIndex,
            selectedOption,
            event.messageId
          );

          if (!success && event.messageId) {
            const errorCard = createQuestionErrorCard('问题已过期或不存在');
            await feishuClient.updateCard(event.messageId, errorCard);
          }
          break;
        }

        case 'switch_project_in_chat': {
          const chatId = event.chatId || (event.action.value as { chatId?: string })?.chatId;
          const projectPath = event.action.option;
          
          if (!chatId || !projectPath) {
            logger.warn('切换项目缺少必要参数', { chatId, projectPath });
            return;
          }

          const sessionChat = sessionManager.getSessionChat(chatId);
          if (!sessionChat) {
            logger.warn('切换项目：非会话群', { chatId });
            return;
          }

          await sessionManager.switchProject(chatId, projectPath);
          const newSessionId = await sessionManager.createNewSession(chatId);
          
          const project = projects.find(p => p.path === projectPath);
          const projectName = project?.name || projectPath;
          
          const card = createProjectSwitchedCard(projectName, projectPath, newSessionId);
          await feishuClient.sendCard(chatId, card);
          break;
        }

        case 'new_session_in_chat': {
          const chatId = event.chatId || (event.action.value as { chatId?: string })?.chatId;
          
          if (!chatId) {
            logger.warn('新建会话缺少 chatId');
            return;
          }

          const sessionChat = sessionManager.getSessionChat(chatId);
          if (!sessionChat) {
            logger.warn('新建会话：非会话群', { chatId });
            return;
          }

          const newSessionId = await sessionManager.createNewSession(chatId);
          const shortId = newSessionId.replace(/^ses_/, '').slice(0, 8);
          
          const card = createSuccessCard('✅ 新会话已创建', `会话 ID：\`${shortId}\`\n\n发送消息开始新对话`);
          await feishuClient.sendCard(chatId, card);
          break;
        }

        case 'show_status_in_chat': {
          const chatId = event.chatId || (event.action.value as { chatId?: string })?.chatId;
          
          if (!chatId) {
            logger.warn('显示状态缺少 chatId');
            return;
          }

          const sessionChat = sessionManager.getSessionChat(chatId);
          if (!sessionChat) {
            const card = createErrorCard('无会话', '当前没有活跃的会话');
            await feishuClient.sendCard(chatId, card);
            return;
          }

          const status: SessionStatus = {
            sessionId: sessionChat.session_id,
            projectPath: sessionChat.project_path,
            isActive: true,
          };
          const card = createStatusCard(status);
          await feishuClient.sendCard(chatId, card);
          break;
        }
        
        default:
          logger.debug('未处理的卡片交互', { action: actionType });
      }
    } catch (error) {
      logger.error('处理卡片交互时出错', error);
    }
  });
}
