export { 
  createMockMessageEvent, 
  extractTextFromContent,
  resetEventIdCounter,
  type MockFeishuMessageEvent 
} from './feishu-mock';

export { 
  createMockOpencodeClient, 
  MockOpencodeClient,
  type MockOpencodeSession,
  type MockOpencodeEvent 
} from './opencode-mock';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    FEISHU_APP_ID: 'cli_test_app_id',
    FEISHU_APP_SECRET: 'test_app_secret_123',
    ADMIN_USER_IDS: 'ou_admin_user_id',
    DATABASE_PATH: ':memory:',
    OPENCODE_SERVER_URL: 'http://localhost:4096',
    LOG_LEVEL: 'error',
    ...overrides,
  };
}
