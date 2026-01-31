import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { BotDatabase } from '../database';
import { AuthManager } from '../auth/whitelist';

describe('Auth / Whitelist', () => {
  let db: BotDatabase;
  let authManager: AuthManager;
  const adminIds = ['admin_user_1', 'admin_user_2'];

  beforeEach(() => {
    db = new BotDatabase(':memory:');
    authManager = new AuthManager(db, { adminUserIds: adminIds });
  });

  afterEach(() => {
    db.close();
  });

  describe('isAdmin', () => {
    test('returns true for admin users', () => {
      expect(authManager.isAdmin('admin_user_1')).toBe(true);
      expect(authManager.isAdmin('admin_user_2')).toBe(true);
    });

    test('returns false for non-admin users', () => {
      expect(authManager.isAdmin('regular_user')).toBe(false);
    });
  });

  describe('isAuthorized', () => {
    test('admin users are always authorized', () => {
      expect(authManager.isAuthorized('admin_user_1')).toBe(true);
    });

    test('whitelisted users are authorized', () => {
      db.addToWhitelist('regular_user', 'admin_user_1');
      expect(authManager.isAuthorized('regular_user')).toBe(true);
    });

    test('non-whitelisted users are not authorized', () => {
      expect(authManager.isAuthorized('random_user')).toBe(false);
    });
  });

  describe('addToWhitelist', () => {
    test('admin can add users to whitelist', () => {
      const added = authManager.addToWhitelist('new_user', 'admin_user_1');
      
      expect(added).toBe(true);
      expect(authManager.isAuthorized('new_user')).toBe(true);
    });

    test('non-admin cannot add users to whitelist', () => {
      const added = authManager.addToWhitelist('new_user', 'regular_user');
      
      expect(added).toBe(false);
      expect(authManager.isAuthorized('new_user')).toBe(false);
    });
  });

  describe('removeFromWhitelist', () => {
    test('admin can remove users from whitelist', () => {
      db.addToWhitelist('user_to_remove', 'admin_user_1');
      
      const removed = authManager.removeFromWhitelist('user_to_remove', 'admin_user_1');
      
      expect(removed).toBe(true);
      expect(authManager.isAuthorized('user_to_remove')).toBe(false);
    });

    test('non-admin cannot remove users from whitelist', () => {
      db.addToWhitelist('user_to_remove', 'admin_user_1');
      
      const removed = authManager.removeFromWhitelist('user_to_remove', 'regular_user');
      
      expect(removed).toBe(false);
      expect(authManager.isAuthorized('user_to_remove')).toBe(true);
    });
  });

  describe('getWhitelistedUsers', () => {
    test('returns all whitelisted users', () => {
      db.addToWhitelist('user_1', 'admin_user_1');
      db.addToWhitelist('user_2', 'admin_user_1');
      
      const users = authManager.getWhitelistedUsers();
      
      expect(users).toHaveLength(2);
      expect(users.map(u => u.user_id)).toContain('user_1');
      expect(users.map(u => u.user_id)).toContain('user_2');
    });
  });

  describe('getAdminUserIds', () => {
    test('returns copy of admin user IDs', () => {
      const adminUserIds = authManager.getAdminUserIds();
      
      expect(adminUserIds).toEqual(adminIds);
      
      adminUserIds.push('new_admin');
      expect(authManager.getAdminUserIds()).toEqual(adminIds);
    });
  });
});
