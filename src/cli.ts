/**
 * CLI 参数解析模块
 * 支持命令行参数启动时配置默认模型、项目等
 */

export interface CliOptions {
  /** 默认模型 ID (格式: provider/model) */
  model?: string;
  /** 默认项目目录 */
  project?: string;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 显示帮助信息 */
  help?: boolean;
  /** 显示版本 */
  version?: boolean;
  /** 列出可用模型 */
  listModels?: boolean;
}

/** CLI 参数定义 */
interface ArgDef {
  short?: string;
  long: string;
  description: string;
  hasValue: boolean;
  envVar?: string;
}

const ARG_DEFS: Record<keyof CliOptions, ArgDef> = {
  model: {
    short: 'm',
    long: 'model',
    description: '设置默认模型 (格式: provider/model)',
    hasValue: true,
    envVar: 'DEFAULT_MODEL',
  },
  project: {
    short: 'p',
    long: 'project',
    description: '设置默认项目目录',
    hasValue: true,
  },
  logLevel: {
    short: 'l',
    long: 'log-level',
    description: '日志级别 (debug|info|warn|error)',
    hasValue: true,
    envVar: 'LOG_LEVEL',
  },
  help: {
    short: 'h',
    long: 'help',
    description: '显示帮助信息',
    hasValue: false,
  },
  version: {
    short: 'v',
    long: 'version',
    description: '显示版本号',
    hasValue: false,
  },
  listModels: {
    long: 'list-models',
    description: '列出可用模型并退出',
    hasValue: false,
  },
};

/** 解析 CLI 参数 */
export function parseArgs(args: string[] = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {};
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (!arg || (!arg.startsWith('-') && !arg.startsWith('--'))) {
      i++;
      continue;
    }
    
    let key: keyof CliOptions | undefined;
    let value: string | undefined;
    
    if (arg.startsWith('--')) {
      // 长参数: --model=xxx 或 --model xxx
      const longArg = arg.slice(2);
      const eqIndex = longArg.indexOf('=');
      
      if (eqIndex >= 0) {
        const longName = longArg.slice(0, eqIndex);
        value = longArg.slice(eqIndex + 1);
        key = findKeyByLong(longName);
      } else {
        key = findKeyByLong(longArg);
        const def = key ? ARG_DEFS[key] : undefined;
        const nextArg = args[i + 1];
        if (def?.hasValue && nextArg && !nextArg.startsWith('-')) {
          value = args[++i];
        }
      }
    } else if (arg.startsWith('-')) {
      const shortArg = arg.slice(1);
      key = findKeyByShort(shortArg);
      const def = key ? ARG_DEFS[key] : undefined;
      const nextArg = args[i + 1];
      if (def?.hasValue && nextArg && !nextArg.startsWith('-')) {
        value = args[++i];
      }
    }
    
    if (key) {
      const def = ARG_DEFS[key];
      if (def.hasValue) {
        (options as Record<string, unknown>)[key] = value;
      } else {
        (options as Record<string, unknown>)[key] = true;
      }
    }
    
    i++;
  }
  
  return options;
}

function findKeyByLong(long: string): keyof CliOptions | undefined {
  for (const [key, def] of Object.entries(ARG_DEFS) as Array<[keyof CliOptions, ArgDef]>) {
    if (def.long === long) {
      return key;
    }
  }
  return undefined;
}

function findKeyByShort(short: string): keyof CliOptions | undefined {
  for (const [key, def] of Object.entries(ARG_DEFS) as Array<[keyof CliOptions, ArgDef]>) {
    if (def.short === short) {
      return key;
    }
  }
  return undefined;
}

/** 格式化帮助信息 */
export function formatHelp(): string {
  const lines: string[] = [
    'OpenCode 飞书机器人',
    '',
    '用法: opencode-feishu-bot [选项]',
    '',
    '选项:',
  ];
  
  for (const [, def] of Object.entries(ARG_DEFS)) {
    const shortPart = def.short ? `-${def.short}, ` : '    ';
    const longPart = `--${def.long}`;
    const valuePart = def.hasValue ? ' <value>' : '';
    lines.push(`  ${shortPart}${longPart}${valuePart}`);
    lines.push(`        ${def.description}`);
  }
  
  lines.push('');
  lines.push('环境变量:');
  lines.push('  FEISHU_APP_ID        飞书应用 ID (必需)');
  lines.push('  FEISHU_APP_SECRET    飞书应用密钥 (必需)');
  lines.push('  DEFAULT_MODEL        默认模型 (可被 --model 覆盖)');
  lines.push('  AVAILABLE_MODELS     可用模型列表 (逗号分隔)');
  lines.push('  PROJECTS             预配置项目列表');
  lines.push('  DATABASE_PATH        数据库路径 (默认: ./data/bot.db)');
  lines.push('  LOG_LEVEL            日志级别 (默认: info)');
  lines.push('');
  lines.push('示例:');
  lines.push('  # 使用指定模型启动');
  lines.push('  opencode-feishu-bot --model anthropic/claude-sonnet-4-20250514');
  lines.push('');
  lines.push('  # 指定项目目录启动');
  lines.push('  opencode-feishu-bot -p /path/to/project');
  lines.push('');
  lines.push('  # 列出可用模型');
  lines.push('  opencode-feishu-bot --list-models');
  
  return lines.join('\n');
}

/** 获取版本号 */
export function getVersion(): string {
  try {
    const pkg = require('../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** 验证日志级别 */
export function isValidLogLevel(level: string): level is 'debug' | 'info' | 'warn' | 'error' {
  return ['debug', 'info', 'warn', 'error'].includes(level);
}
