import { test, expect, describe, beforeEach } from 'bun:test';
import { 
  createMockMessageEvent, 
  extractTextFromContent,
  createMockOpencodeClient,
  createTestEnv,
  resetEventIdCounter 
} from './helpers';

describe('Test Infrastructure', () => {
  beforeEach(() => {
    resetEventIdCounter();
  });

  describe('Feishu Mock', () => {
    test('creates valid message event', () => {
      const event = createMockMessageEvent('Hello world');
      
      expect(event.schema).toBe('2.0');
      expect(event.header.event_type).toBe('im.message.receive_v1');
      expect(event.event.message.chat_type).toBe('p2p');
      expect(event.event.message.message_type).toBe('text');
    });

    test('allows custom options', () => {
      const event = createMockMessageEvent('Test', {
        openId: 'custom_open_id',
        chatId: 'custom_chat_id',
        chatType: 'group',
      });
      
      expect(event.event.sender.sender_id.open_id).toBe('custom_open_id');
      expect(event.event.message.chat_id).toBe('custom_chat_id');
      expect(event.event.message.chat_type).toBe('group');
    });

    test('extracts text from content', () => {
      const text = extractTextFromContent('{"text":"Hello world"}');
      expect(text).toBe('Hello world');
    });

    test('handles invalid content gracefully', () => {
      const text = extractTextFromContent('invalid json');
      expect(text).toBe('');
    });
  });

  describe('OpenCode Mock', () => {
    test('creates session', async () => {
      const client = createMockOpencodeClient();
      const session = await client.createSession('/test/project');
      
      expect(session.id).toStartWith('session_');
      expect(session.projectPath).toBe('/test/project');
    });

    test('retrieves session', async () => {
      const client = createMockOpencodeClient();
      const created = await client.createSession('/test/project');
      const retrieved = await client.getSession(created.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    test('emits events on message', async () => {
      const client = createMockOpencodeClient();
      const session = await client.createSession('/test/project');
      
      const events: string[] = [];
      client.subscribe(session.id, (event) => {
        events.push(event.type);
      });
      
      await client.sendMessage(session.id, 'Hello');
      
      expect(events).toContain('message.start');
      expect(events).toContain('message.delta');
      expect(events).toContain('message.complete');
    });
  });

  describe('Test Environment', () => {
    test('creates valid test config', () => {
      const env = createTestEnv();
      
      expect(env.FEISHU_APP_ID).toBeDefined();
      expect(env.FEISHU_APP_SECRET).toBeDefined();
      expect(env.DATABASE_PATH).toBe(':memory:');
    });

    test('allows overrides', () => {
      const env = createTestEnv({ DATABASE_PATH: '/custom/path.db' });
      
      expect(env.DATABASE_PATH).toBe('/custom/path.db');
    });
  });
});
