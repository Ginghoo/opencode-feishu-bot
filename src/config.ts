import { z } from 'zod';

export interface ProjectConfig {
  path: string;
  name: string;
}

const envSchema = z.object({
  FEISHU_APP_ID: z.string().min(1, '必须提供 FEISHU_APP_ID'),
  
  FEISHU_APP_SECRET: z.string().min(1, '必须提供 FEISHU_APP_SECRET'),
  
  ADMIN_USER_IDS: z.string().default(''),
  
  DATABASE_PATH: z.string().default('./data/bot.db'),
  
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  ALLOW_ALL_USERS: z.preprocess(
    (v) => v === undefined ? true : v !== 'false',
    z.boolean()
  ).default(true),
  
  PROJECTS: z.string().default(''),
  
  MENU_SERVER_URL: z.string().optional(),
  
  AVAILABLE_MODELS: z.string().default(''),
  
  DEFAULT_MODEL: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export interface CliOverrides {
  model?: string;
  project?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(overrides?: CliOverrides): Config {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(e => 
      `${String(e.path.join('.'))}: ${e.message}`
    ).join('\n');
    throw new Error(`配置验证失败:\n${errors}`);
  }
  
  const config = result.data;
  
  if (overrides?.model) {
    config.DEFAULT_MODEL = overrides.model;
  }
  if (overrides?.logLevel) {
    config.LOG_LEVEL = overrides.logLevel;
  }
  
  return config;
}

export function getAdminUserIds(config: Config): string[] {
  return config.ADMIN_USER_IDS
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

export function getDefaultProjectPath(override?: string): string {
  return override || process.cwd();
}

export function getDefaultModel(config: Config): string | undefined {
  return config.DEFAULT_MODEL;
}

export function getProjects(config: Config): ProjectConfig[] {
  if (!config.PROJECTS.trim()) {
    return [];
  }
  
  return config.PROJECTS
    .split(',')
    .map(item => {
      const [path, name] = item.split(':').map(s => s.trim());
      if (!path) return null;
      return { path, name: name || path };
    })
    .filter((item): item is ProjectConfig => item !== null);
}

export interface ModelConfig {
  id: string;
  name?: string;
}

export function getAvailableModels(config: Config): ModelConfig[] {
  if (!config.AVAILABLE_MODELS.trim()) {
    return [];
  }
  
  const models: ModelConfig[] = [];
  
  for (const item of config.AVAILABLE_MODELS.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    
    const lastColonIndex = trimmed.lastIndexOf(':');
    if (lastColonIndex === -1) {
      models.push({ id: trimmed });
    } else {
      const id = trimmed.slice(0, lastColonIndex).trim();
      const name = trimmed.slice(lastColonIndex + 1).trim();
      if (id) {
        models.push(name ? { id, name } : { id });
      }
    }
  }
  
  return models;
}

export function filterModels<T extends { id: string; name: string }>(
  allModels: T[],
  configuredModels: ModelConfig[]
): T[] {
  if (configuredModels.length === 0) {
    return allModels;
  }
  
  const result: T[] = [];
  
  for (const configured of configuredModels) {
    const found = allModels.find(m => m.id === configured.id);
    if (found) {
      result.push(configured.name ? { ...found, name: configured.name } : found);
    }
  }
  
  return result;
}
