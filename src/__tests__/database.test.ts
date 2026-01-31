import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { BotDatabase } from '../database';

describe('Database Layer', () => {
  let db: BotDatabase;

  beforeEach(() => {
    db = new BotDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('User Sessions', () => {
    test('returns null for non-existent session', () => {
      const session = db.getSession('non_existent_chat');
      expect(session).toBeNull();
    });

    test('creates and retrieves session', () => {
      db.upsertSession('chat_1', 'session_123', '/path/to/project');
      
      const session = db.getSession('chat_1');
      expect(session).not.toBeNull();
      expect(session!.chat_id).toBe('chat_1');
      expect(session!.session_id).toBe('session_123');
      expect(session!.project_path).toBe('/path/to/project');
    });

    test('updates existing session', () => {
      db.upsertSession('chat_1', 'session_123', '/path/to/project');
      db.upsertSession('chat_1', 'session_456', '/new/path');
      
      const session = db.getSession('chat_1');
      expect(session!.session_id).toBe('session_456');
      expect(session!.project_path).toBe('/new/path');
    });

    test('deletes session', () => {
      db.upsertSession('chat_1', 'session_123', '/path/to/project');
      
      const deleted = db.deleteSession('chat_1');
      expect(deleted).toBe(true);
      expect(db.getSession('chat_1')).toBeNull();
    });

    test('returns false when deleting non-existent session', () => {
      const deleted = db.deleteSession('non_existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Whitelist', () => {
    test('returns false for non-whitelisted user', () => {
      const isWhitelisted = db.isUserWhitelisted('user_1');
      expect(isWhitelisted).toBe(false);
    });

    test('adds user to whitelist', () => {
      const added = db.addToWhitelist('user_1', 'admin_1');
      
      expect(added).toBe(true);
      expect(db.isUserWhitelisted('user_1')).toBe(true);
    });

    test('does not add duplicate user', () => {
      db.addToWhitelist('user_1', 'admin_1');
      const addedAgain = db.addToWhitelist('user_1', 'admin_2');
      
      expect(addedAgain).toBe(false);
    });

    test('removes user from whitelist', () => {
      db.addToWhitelist('user_1', 'admin_1');
      const removed = db.removeFromWhitelist('user_1');
      
      expect(removed).toBe(true);
      expect(db.isUserWhitelisted('user_1')).toBe(false);
    });

    test('returns false when removing non-existent user', () => {
      const removed = db.removeFromWhitelist('non_existent');
      expect(removed).toBe(false);
    });

    test('lists all whitelisted users', () => {
      db.addToWhitelist('user_1', 'admin_1');
      db.addToWhitelist('user_2', 'admin_1');
      
      const users = db.getWhitelistedUsers();
      expect(users).toHaveLength(2);
      expect(users.map(u => u.user_id)).toContain('user_1');
      expect(users.map(u => u.user_id)).toContain('user_2');
    });
  });

  describe('Project Mappings', () => {
    test('returns null for non-existent mapping', () => {
      const path = db.getProjectPath('chat_1');
      expect(path).toBeNull();
    });

    test('sets and gets project path', () => {
      db.setProjectPath('chat_1', '/my/project');
      
      const path = db.getProjectPath('chat_1');
      expect(path).toBe('/my/project');
    });

    test('updates existing project path', () => {
      db.setProjectPath('chat_1', '/old/path');
      db.setProjectPath('chat_1', '/new/path');
      
      const path = db.getProjectPath('chat_1');
      expect(path).toBe('/new/path');
    });
  });

  describe('Event Deduplication', () => {
    test('returns false for new event', () => {
      const isProcessed = db.isEventProcessed('event_1');
      expect(isProcessed).toBe(false);
    });

    test('marks event as processed', () => {
      const marked = db.markEventProcessed('event_1');
      
      expect(marked).toBe(true);
      expect(db.isEventProcessed('event_1')).toBe(true);
    });

    test('returns false when marking already processed event', () => {
      db.markEventProcessed('event_1');
      const markedAgain = db.markEventProcessed('event_1');
      
      expect(markedAgain).toBe(false);
    });

    test('cleans up old events', async () => {
      const shortWindowDb = new BotDatabase(':memory:', 100);
      
      shortWindowDb.markEventProcessed('old_event');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cleaned = shortWindowDb.cleanupOldEvents();
      expect(cleaned).toBe(1);
      expect(shortWindowDb.isEventProcessed('old_event')).toBe(false);
      
      shortWindowDb.close();
    });
  });
});
