/**
 * 权限管理模块
 * 管理管理员和白名单用户权限
 */
import type { BotDatabase } from '../database';
import { logger } from '../utils/logger';

export interface AuthConfig {
  adminUserIds: string[];
}

export class AuthManager {
  private db: BotDatabase;
  private config: AuthConfig;

  constructor(db: BotDatabase, config: AuthConfig) {
    this.db = db;
    this.config = config;
  }

  isAdmin(userId: string): boolean {
    return this.config.adminUserIds.includes(userId);
  }

  isAuthorized(userId: string): boolean {
    if (this.isAdmin(userId)) {
      return true;
    }
    return this.db.isUserWhitelisted(userId);
  }

  addToWhitelist(userId: string, addedBy: string): boolean {
    if (!this.isAdmin(addedBy)) {
      logger.warn('非管理员尝试添加白名单', { userId, addedBy });
      return false;
    }
    return this.db.addToWhitelist(userId, addedBy);
  }

  removeFromWhitelist(userId: string, removedBy: string): boolean {
    if (!this.isAdmin(removedBy)) {
      logger.warn('非管理员尝试移除白名单', { userId, removedBy });
      return false;
    }
    return this.db.removeFromWhitelist(userId);
  }

  getWhitelistedUsers(): Array<{ user_id: string; added_by: string; added_at: string }> {
    return this.db.getWhitelistedUsers();
  }

  getAdminUserIds(): string[] {
    return [...this.config.adminUserIds];
  }
}

export function createAuthManager(db: BotDatabase, config: AuthConfig): AuthManager {
  return new AuthManager(db, config);
}
