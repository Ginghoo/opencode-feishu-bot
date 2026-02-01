import { BaseChannel } from '../base';
import type {
  ChannelCapabilities,
  CardUpdateResult,
  SendMessageOptions,
  MessageEvent as ChannelMessageEvent,
  MessageRecalledEvent as ChannelRecalledEvent,
  BotEvent,
  MemberEvent,
  GroupDisbandedEvent,
  CardActionEvent as ChannelCardActionEvent,
  MenuActionEvent,
} from '../../types/channel';
import type { UnifiedReply } from '../../types/message';
import { MessageConverter } from '../converter';
import { 
  FeishuClient, 
  createFeishuClient,
  parseTextContent,
  parseImageContent,
  cleanMentionsFromText,
  type FeishuConfig,
  type MessageEvent,
  type MessageRecalledEvent,
  type BotAddedEvent,
  type BotRemovedEvent,
  type UserLeftChatEvent,
  type ChatDisbandedEvent,
  type CardActionEvent,
  type BotMenuEvent,
} from '../../feishu/client';
import { logger } from '../../utils/logger';
import { CardBuilder } from './card-builder';

export interface FeishuChannelConfig extends FeishuConfig {
  streamingThrottleMs?: number;
}

export class FeishuChannel extends BaseChannel {
  readonly id = 'feishu';
  readonly type = 'feishu';
  readonly capabilities: ChannelCapabilities = {
    supported: [
      'text',
      'image',
      'file',
      'card',
      'streaming',
      'mention',
      'richtext',
      'document',
      'sheet',
      'group',
      'recall',
    ],
    streamingThrottleMs: 300,
    maxMessageLength: 30000,
    maxAttachments: 10,
  };

  private client: FeishuClient;
  private cardBuilder: CardBuilder;

  constructor(config: FeishuChannelConfig) {
    super();
    this.client = createFeishuClient(config);
    this.cardBuilder = new CardBuilder();
    
    if (config.streamingThrottleMs) {
      this.capabilities.streamingThrottleMs = config.streamingThrottleMs;
    }
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.onMessage(async (event) => {
      await this.handleMessage(event);
    });

    this.client.onMessageRecalled(async (event) => {
      await this.handleMessageRecalled(event);
    });

    this.client.onBotAdded(async (event) => {
      await this.handleBotAdded(event);
    });

    this.client.onBotRemoved(async (event) => {
      await this.handleBotRemoved(event);
    });

    this.client.onUserLeftChat(async (event) => {
      await this.handleUserLeftChat(event);
    });

    this.client.onChatDisbanded(async (event) => {
      await this.handleChatDisbanded(event);
    });

    this.client.onCardAction(async (event) => {
      await this.handleCardAction(event);
    });

    this.client.onBotMenu(async (event) => {
      await this.handleMenuAction(event);
    });
  }

  async connect(): Promise<void> {
    await this.client.start();
    this.setConnected(true);
    logger.info('FeishuChannel connected');
  }

  async disconnect(): Promise<void> {
    await this.client.stop();
    this.setConnected(false);
    logger.info('FeishuChannel disconnected');
  }

  async sendMessage(
    chatId: string, 
    message: UnifiedReply, 
    options?: SendMessageOptions
  ): Promise<string> {
    const card = this.cardBuilder.buildFromReply(message);
    const messageId = await this.client.sendCard(chatId, card);
    
    if (!messageId) {
      throw new Error('Failed to send message');
    }
    
    return messageId;
  }

  async updateMessage(messageId: string, message: UnifiedReply): Promise<CardUpdateResult> {
    const card = this.cardBuilder.buildFromReply(message);
    return this.client.updateCard(messageId, card);
  }

  async recallMessage(messageId: string): Promise<boolean> {
    return this.client.deleteMessage(messageId);
  }

  async downloadAttachment(attachmentId: string): Promise<Buffer> {
    const [messageId, imageKey] = attachmentId.split(':');
    if (!messageId || !imageKey) {
      throw new Error('Invalid attachment ID format');
    }
    
    const result = await this.client.getMessageImage(messageId, imageKey);
    if (!result) {
      throw new Error('Failed to download attachment');
    }
    
    return result.data;
  }

  async getUserInfo(userId: string): Promise<{ id: string; name: string; avatar?: string }> {
    return { id: userId, name: userId };
  }

  getFeishuClient(): FeishuClient {
    return this.client;
  }

  async createChat(name: string, userIds: string[]): Promise<string | null> {
    const result = await this.client.createChat(name, userIds);
    return result?.chatId ?? null;
  }

  async updateChatName(chatId: string, name: string): Promise<boolean> {
    return this.client.updateChatName(chatId, name);
  }

  async deleteChat(chatId: string): Promise<boolean> {
    return this.client.deleteChat(chatId);
  }

  async sendTextMessage(chatId: string, text: string): Promise<string | null> {
    return this.client.sendTextMessage(chatId, text);
  }

  async sendCardToUser(userId: string, card: object): Promise<string | null> {
    return this.client.sendCardToUser(userId, card);
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const text = event.messageType === 'text' 
      ? cleanMentionsFromText(parseTextContent(event.content), event.mentions)
      : '';

    const channelEvent: ChannelMessageEvent = {
      type: 'message',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: parseInt(event.createTime, 10),
      messageId: event.messageId,
      chatId: event.chatId,
      chatType: event.chatType === 'p2p' ? 'private' : 'group',
      senderId: event.senderId,
      senderType: event.senderType === 'user' ? 'user' : 'bot',
      messageType: event.messageType,
      content: text,
      mentions: event.mentions,
    };

    if (event.messageType === 'image') {
      const imageKey = parseImageContent(event.content);
      if (imageKey) {
        channelEvent.attachments = [{
          type: 'image',
          id: `${event.messageId}:${imageKey}`,
        }];
      }
    }

    await this.emit(channelEvent);
  }

  private async handleMessageRecalled(event: MessageRecalledEvent): Promise<void> {
    const recallTypeMap: Record<string, 'owner' | 'admin' | 'system'> = {
      'message_owner': 'owner',
      'group_owner': 'admin',
      'group_manager': 'admin',
      'enterprise_manager': 'system',
    };

    const channelEvent: ChannelRecalledEvent = {
      type: 'message_recalled',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: parseInt(event.recallTime, 10),
      messageId: event.messageId,
      chatId: event.chatId,
      recallType: recallTypeMap[event.recallType] || 'owner',
    };

    await this.emit(channelEvent);
  }

  private async handleBotAdded(event: BotAddedEvent): Promise<void> {
    const channelEvent: BotEvent = {
      type: 'bot_added',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: Date.now(),
      chatId: event.chatId,
      operatorId: event.operatorId,
      chatName: event.chatName,
    };

    await this.emit(channelEvent);
  }

  private async handleBotRemoved(event: BotRemovedEvent): Promise<void> {
    const channelEvent: BotEvent = {
      type: 'bot_removed',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: Date.now(),
      chatId: event.chatId,
      operatorId: event.operatorId,
    };

    await this.emit(channelEvent);
  }

  private async handleUserLeftChat(event: UserLeftChatEvent): Promise<void> {
    const channelEvent: MemberEvent = {
      type: 'member_removed',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: Date.now(),
      chatId: event.chatId,
      memberIds: event.users.map(u => u.userId),
      operatorId: event.operatorId,
    };

    await this.emit(channelEvent);
  }

  private async handleChatDisbanded(event: ChatDisbandedEvent): Promise<void> {
    const channelEvent: GroupDisbandedEvent = {
      type: 'group_disbanded',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: Date.now(),
      chatId: event.chatId,
      operatorId: event.operatorId,
    };

    await this.emit(channelEvent);
  }

  private async handleCardAction(event: CardActionEvent): Promise<void> {
    const channelEvent: ChannelCardActionEvent = {
      type: 'card_action',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: Date.now(),
      messageId: event.messageId ?? '',
      chatId: event.chatId ?? '',
      operatorId: event.operatorId,
      actionId: event.action.tag,
      actionValue: event.action.value,
    };

    await this.emit(channelEvent);
  }

  private async handleMenuAction(event: BotMenuEvent): Promise<void> {
    const channelEvent: MenuActionEvent = {
      type: 'menu_action',
      eventId: event.eventId,
      channelId: this.id,
      timestamp: parseInt(event.timestamp, 10) || Date.now(),
      operatorId: event.operatorId,
      chatId: event.chatId,
      eventKey: event.eventKey,
    };

    await this.emit(channelEvent);
  }
}

export { CardBuilder } from './card-builder';
