/**
 * 命令解析模块
 * 定义和解析机器人命令
 */

export interface Command {
  name: string;
  description: string;
  usage: string;
  adminOnly: boolean;
}

export interface ParsedCommand {
  command: string;
  args: string[];
  rawArgs: string;
}

const COMMAND_PREFIX = '/';

export const COMMANDS: Record<string, Command> = {
  new: {
    name: 'new',
    description: '在当前项目中创建新会话',
    usage: '/new',
    adminOnly: false,
  },
  model: {
    name: 'model',
    description: '切换 AI 模型',
    usage: '/model <编号或模型ID>',
    adminOnly: false,
  },
  compact: {
    name: 'compact',
    description: '压缩当前会话上下文',
    usage: '/compact',
    adminOnly: false,
  },
  clear: {
    name: 'clear',
    description: '清除历史，创建新会话',
    usage: '/clear',
    adminOnly: false,
  },
  exit: {
    name: 'exit',
    description: '退出并删除当前会话群',
    usage: '/exit',
    adminOnly: false,
  },
  project: {
    name: 'project',
    description: '查看和切换项目目录',
    usage: '/project [编号]',
    adminOnly: false,
  },
  help: {
    name: 'help',
    description: '显示可用命令',
    usage: '/help',
    adminOnly: false,
  },
  abort: {
    name: 'abort',
    description: '中止当前运行的任务',
    usage: '/abort',
    adminOnly: false,
  },
  status: {
    name: 'status',
    description: '显示当前会话状态',
    usage: '/status',
    adminOnly: false,
  },
  whitelist_add: {
    name: 'whitelist_add',
    description: '将用户添加到白名单',
    usage: '/whitelist_add <用户ID>',
    adminOnly: true,
  },
  whitelist_remove: {
    name: 'whitelist_remove',
    description: '从白名单移除用户',
    usage: '/whitelist_remove <用户ID>',
    adminOnly: true,
  },
  whitelist_list: {
    name: 'whitelist_list',
    description: '列出所有白名单用户',
    usage: '/whitelist_list',
    adminOnly: true,
  },
  sessions: {
    name: 'sessions',
    description: '查看历史会话列表，选择编号可切换会话',
    usage: '/sessions [编号]',
    adminOnly: false,
  },
  myid: {
    name: 'myid',
    description: '显示你的飞书用户 ID（用于配置通知等）',
    usage: '/myid',
    adminOnly: false,
  },
  doc_read: {
    name: 'doc_read',
    description: '读取飞书文档内容',
    usage: '/doc_read <文档URL或token>',
    adminOnly: false,
  },
  doc_create: {
    name: 'doc_create',
    description: '创建新的飞书文档',
    usage: '/doc_create <标题>',
    adminOnly: false,
  },
};

export function isCommand(text: string): boolean {
  return text.trim().startsWith(COMMAND_PREFIX);
}

export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim();
  
  if (!trimmed.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  const withoutPrefix = trimmed.slice(COMMAND_PREFIX.length);
  const parts = withoutPrefix.split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? '';
  const args = parts.slice(1);
  const rawArgs = withoutPrefix.slice(command.length).trim();

  if (!command) {
    return null;
  }

  return {
    command,
    args,
    rawArgs,
  };
}

export function getCommand(name: string): Command | null {
  return COMMANDS[name] ?? null;
}

export function getAvailableCommands(isAdmin: boolean): Command[] {
  return Object.values(COMMANDS).filter(cmd => !cmd.adminOnly || isAdmin);
}

export function formatHelpMessage(isAdmin: boolean): string {
  const commands = getAvailableCommands(isAdmin);
  
  let message = '**可用命令：**\n\n';
  
  for (const cmd of commands) {
    message += `\`${cmd.usage}\`\n${cmd.description}\n\n`;
  }

  return message;
}

export function formatCommandError(message: string): string {
  return `**命令错误：** ${message}`;
}

export function formatCommandSuccess(message: string): string {
  return `**成功：** ${message}`;
}
