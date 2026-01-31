import { test, expect, describe } from 'bun:test';
import { parseTextContent } from '../feishu/client';
import { createMockMessageEvent, extractTextFromContent } from './helpers';

describe('Feishu Client', () => {
  describe('parseTextContent', () => {
    test('parses valid JSON text content', () => {
      const content = JSON.stringify({ text: 'Hello world' });
      const text = parseTextContent(content);
      expect(text).toBe('Hello world');
    });

    test('returns empty string for invalid JSON', () => {
      const text = parseTextContent('not json');
      expect(text).toBe('');
    });

    test('returns empty string for JSON without text field', () => {
      const content = JSON.stringify({ other: 'field' });
      const text = parseTextContent(content);
      expect(text).toBe('');
    });
  });

  describe('Mock Message Events', () => {
    test('creates p2p message event by default', () => {
      const event = createMockMessageEvent('Test message');
      
      expect(event.event.message.chat_type).toBe('p2p');
      expect(event.header.event_type).toBe('im.message.receive_v1');
    });

    test('extracts text from message content', () => {
      const event = createMockMessageEvent('Hello from test');
      const text = extractTextFromContent(event.event.message.content);
      
      expect(text).toBe('Hello from test');
    });

    test('creates group message when specified', () => {
      const event = createMockMessageEvent('Group message', { chatType: 'group' });
      
      expect(event.event.message.chat_type).toBe('group');
    });

    test('uses custom IDs when provided', () => {
      const event = createMockMessageEvent('Custom IDs', {
        openId: 'ou_custom_user',
        chatId: 'oc_custom_chat',
        messageId: 'om_custom_msg',
        eventId: 'evt_custom_event',
      });
      
      expect(event.event.sender.sender_id.open_id).toBe('ou_custom_user');
      expect(event.event.message.chat_id).toBe('oc_custom_chat');
      expect(event.event.message.message_id).toBe('om_custom_msg');
      expect(event.header.event_id).toBe('evt_custom_event');
    });
  });
});
