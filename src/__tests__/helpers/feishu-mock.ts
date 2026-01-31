export interface MockFeishuMessageEvent {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: {
    sender: {
      sender_id: {
        open_id: string;
        user_id?: string;
        union_id?: string;
      };
      sender_type: string;
      tenant_key: string;
    };
    message: {
      message_id: string;
      root_id?: string;
      parent_id?: string;
      create_time: string;
      chat_id: string;
      chat_type: 'p2p' | 'group';
      message_type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'post' | 'interactive';
      content: string;
    };
  };
}

let eventIdCounter = 0;

export function createMockMessageEvent(
  text: string,
  options: {
    openId?: string;
    chatId?: string;
    chatType?: 'p2p' | 'group';
    messageId?: string;
    eventId?: string;
  } = {}
): MockFeishuMessageEvent {
  eventIdCounter++;
  const now = Date.now();
  
  return {
    schema: '2.0',
    header: {
      event_id: options.eventId ?? `evt_${now}_${eventIdCounter}`,
      event_type: 'im.message.receive_v1',
      create_time: String(now),
      token: 'mock_token',
      app_id: 'cli_mock_app_id',
      tenant_key: 'tenant_mock',
    },
    event: {
      sender: {
        sender_id: {
          open_id: options.openId ?? 'ou_mock_user_id',
          user_id: 'mock_user_id',
          union_id: 'on_mock_union_id',
        },
        sender_type: 'user',
        tenant_key: 'tenant_mock',
      },
      message: {
        message_id: options.messageId ?? `om_${now}`,
        create_time: String(now),
        chat_id: options.chatId ?? 'oc_mock_chat_id',
        chat_type: options.chatType ?? 'p2p',
        message_type: 'text',
        content: JSON.stringify({ text }),
      },
    },
  };
}

export function extractTextFromContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return parsed.text || '';
  } catch {
    return '';
  }
}

export function resetEventIdCounter(): void {
  eventIdCounter = 0;
}
