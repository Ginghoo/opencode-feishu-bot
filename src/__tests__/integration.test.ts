import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { BotDatabase } from '../database';
import { parseTextContent } from '../feishu/client';
import { isCommand, parseCommand } from '../commands/parser';
import { 
  createMockMessageEvent, 
  extractTextFromContent,
  createMockOpencodeClient,
} from './helpers';

describe('Integration Tests', () => {
  let db: BotDatabase;

  beforeEach(() => {
    db = new BotDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('End-to-End Message Flow', () => {
    test('processes text message correctly', () => {
      const event = createMockMessageEvent('Hello, please help me with coding');
      
      expect(event.event.message.chat_type).toBe('p2p');
      
      const text = extractTextFromContent(event.event.message.content);
      expect(text).toBe('Hello, please help me with coding');
      
      expect(isCommand(text)).toBe(false);
    });

    test('filters group messages', () => {
      const event = createMockMessageEvent('Group message', { chatType: 'group' });
      
      expect(event.event.message.chat_type).toBe('group');
    });

    test('processes command correctly', () => {
      const event = createMockMessageEvent('/help');
      const text = extractTextFromContent(event.event.message.content);
      
      expect(isCommand(text)).toBe(true);
      
      const parsed = parseCommand(text);
      expect(parsed).not.toBeNull();
      expect(parsed!.command).toBe('help');
    });

    test('processes switch_project command', () => {
      const event = createMockMessageEvent('/switch_project /home/user/myproject');
      const text = extractTextFromContent(event.event.message.content);
      
      const parsed = parseCommand(text);
      expect(parsed).not.toBeNull();
      expect(parsed!.command).toBe('switch_project');
      expect(parsed!.rawArgs).toBe('/home/user/myproject');
    });
  });

  describe('Database Integration', () => {
    test('creates and retrieves session', () => {
      const chatId = 'oc_test_chat';
      const sessionId = 'ses_test_session';
      const projectPath = '/test/project';
      
      db.upsertSession(chatId, sessionId, projectPath);
      
      const session = db.getSession(chatId);
      expect(session).not.toBeNull();
      expect(session!.session_id).toBe(sessionId);
      expect(session!.project_path).toBe(projectPath);
    });

    test('manages whitelist correctly', () => {
      const userId = 'ou_test_user';
      const adminId = 'ou_admin';
      
      expect(db.isUserWhitelisted(userId)).toBe(false);
      
      db.addToWhitelist(userId, adminId);
      expect(db.isUserWhitelisted(userId)).toBe(true);
      
      db.removeFromWhitelist(userId);
      expect(db.isUserWhitelisted(userId)).toBe(false);
    });

    test('deduplicates events', () => {
      const eventId = 'evt_test_event';
      
      expect(db.isEventProcessed(eventId)).toBe(false);
      
      const firstMark = db.markEventProcessed(eventId);
      expect(firstMark).toBe(true);
      
      const secondMark = db.markEventProcessed(eventId);
      expect(secondMark).toBe(false);
      
      expect(db.isEventProcessed(eventId)).toBe(true);
    });
  });

  describe('OpenCode Mock Integration', () => {
    test('creates session and sends message', async () => {
      const client = createMockOpencodeClient();
      
      const session = await client.createSession('/test/project');
      expect(session.id).toStartWith('session_');
      
      const events: string[] = [];
      client.subscribe(session.id, (event) => {
        events.push(event.type);
      });
      
      await client.sendMessage(session.id, 'Test message');
      
      expect(events).toContain('message.start');
      expect(events).toContain('message.complete');
    });
  });

  describe('Content Parsing', () => {
    test('parses Feishu text content', () => {
      const content = JSON.stringify({ text: 'Hello world' });
      const text = parseTextContent(content);
      expect(text).toBe('Hello world');
    });

    test('handles empty content', () => {
      const text = parseTextContent('{}');
      expect(text).toBe('');
    });

    test('handles invalid JSON', () => {
      const text = parseTextContent('not json');
      expect(text).toBe('');
    });
  });
});
