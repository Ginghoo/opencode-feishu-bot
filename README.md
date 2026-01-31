# OpenCode 飞书机器人

一个飞书聊天机器人，用于与 OpenCode AI 编程助手集成，让你可以通过飞书与 OpenCode 进行交互。

## 功能特性

- **会话群模式**：每个会话创建独立群组，群内无需 @机器人 即可对话
- **自动标题**：首条消息自动设置群组标题，格式 `o{会话ID}-{标题}`
- **会话隔离**：多个会话群互不干扰，用户退出或解散群时自动清理
- **开箱即用**：默认所有用户可用，无需配置白名单
- **菜单系统**：支持飞书应用菜单，快速创建会话、切换项目等
- **自动启动**：OpenCode 服务器随机器人自动启动，无需手动配置
- **流式响应**：实时卡片更新，具有打字效果
- **消息撤回**：用户撤回消息时自动中止任务并撤回 AI 响应
- **项目切换**：支持预配置项目列表，快速切换
- **模型切换**：动态切换 AI 模型
- **可选白名单**：支持启用白名单模式限制访问
- **命令系统**：内置常用操作命令

## 环境要求

- [Bun](https://bun.sh) v1.2.0 或更高版本
- 飞书企业应用，需要：
  - `im:message` 和 `im:message.receive_v1` 权限
  - `im:chat` 权限（创建和管理群聊）
  - `im:chat:readonly` 权限（获取群信息）
  - 启用长连接（WebSocket）模式
  - 订阅事件：接收消息、机器人进群、用户退群、群解散、消息撤回、菜单点击

## 安装

### 作为 npm 包安装

```bash
# 全局安装
npm install -g opencode-feishu-bot

# 或使用 bun
bun add -g opencode-feishu-bot
```

### 从源码安装

```bash
# 克隆仓库
git clone <repository-url>
cd opencode-feishu-bot

# 安装依赖
bun install
```

## 配置

基于 `.env.example` 创建 `.env` 文件：

```bash
cp .env.example .env
```

配置以下环境变量：

| 变量 | 说明 | 必填 |
|------|------|------|
| `FEISHU_APP_ID` | 飞书开放平台的应用 ID | 是 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 是 |
| `ADMIN_USER_IDS` | 管理员 open_id 列表（逗号分隔） | 否 |
| `ALLOW_ALL_USERS` | 是否允许所有用户（默认 `true`，设为 `false` 启用白名单模式） | 否 |
| `PROJECTS` | 预配置项目列表（格式：`路径:名称,路径:名称`） | 否 |
| `DATABASE_PATH` | SQLite 数据库路径 | 否（默认：`./data/bot.db`） |
| `LOG_LEVEL` | 日志级别（debug/info/warn/error） | 否（默认：`info`） |
| `DEFAULT_MODEL` | 默认模型（格式：`provider/model`） | 否 |
| `AVAILABLE_MODELS` | 可用模型列表（逗号分隔） | 否 |

> **注意**：OpenCode 服务器会随机器人自动启动（随机端口），无需手动配置。
> 默认项目目录为机器人启动时的**当前工作目录**。

## 使用方法

### 启动机器人

```bash
# 在你的项目目录中启动
cd /path/to/your/project
opencode-feishu-bot

# 从源码运行 - 生产模式
bun run start

# 从源码运行 - 开发模式（热重载）
bun run dev
```

### CLI 参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--model <id>` | `-m` | 设置默认模型（格式：provider/model） |
| `--project <path>` | `-p` | 设置默认项目目录 |
| `--log-level <level>` | `-l` | 日志级别（debug/info/warn/error） |
| `--list-models` | | 列出所有可用模型并退出 |
| `--help` | `-h` | 显示帮助信息 |
| `--version` | `-v` | 显示版本号 |

示例：

```bash
# 使用指定模型启动
opencode-feishu-bot --model anthropic/claude-sonnet-4-20250514

# 指定项目目录启动
opencode-feishu-bot -p /path/to/project

# 列出所有可用模型
opencode-feishu-bot --list-models

# 组合使用
opencode-feishu-bot -m anthropic/claude-sonnet-4-20250514 -p /path/to/project -l debug
```

### 可用命令

| 命令 | 说明 | 仅管理员 |
|------|------|----------|
| `/help` | 显示可用命令 | 否 |
| `/new <编号>` | 创建新会话群（私聊）/ 切换项目（会话群内） | 否 |
| `/model <编号或ID>` | 切换 AI 模型 | 否 |
| `/compact` | 压缩当前会话上下文 | 否 |
| `/clear` | 清除历史，创建新会话 | 否 |
| `/new_session` | 创建新的 OpenCode 会话 | 否 |
| `/switch_project <路径>` | 切换到不同的项目 | 否 |
| `/abort` | 中止当前运行的任务 | 否 |
| `/status` | 显示会话状态 | 否 |
| `/whitelist_add <用户ID>` | 将用户添加到白名单 | 是 |
| `/whitelist_remove <用户ID>` | 从白名单移除用户 | 是 |
| `/whitelist_list` | 列出所有白名单用户 | 是 |

### 与 OpenCode 交互

**会话群模式（推荐）：**

1. 在私聊中向机器人发送 `/new <项目编号>` 创建新会话群
2. 机器人创建群组并拉你进群
3. 在群内直接发送消息与 AI 对话，无需 @机器人
4. 首条消息会自动设置群组标题（如 `o1a2b3c-实现登录功能`）
5. 退出群组或解散群时自动清理会话数据

**私聊模式：**

直接在私聊中向机器人发送消息，机器人会自动创建或复用会话。

**消息撤回**：如果在 AI 生成响应过程中撤回消息，机器人会自动中止任务并撤回已发送的响应。

## 开发

### 运行测试

```bash
bun test
```

### 项目结构

```
src/
├── index.ts           # 应用入口
├── config.ts          # 配置管理
├── cli.ts             # CLI 参数解析
├── database/          # SQLite 数据库层
├── feishu/            # 飞书 SDK 集成
│   ├── client.ts      # 飞书客户端封装
│   ├── formatter.ts   # 消息格式化
│   ├── streamer.ts    # 流式卡片更新
│   ├── welcome.ts     # 欢迎卡片生成
│   └── menu.ts        # 菜单交互卡片
├── events/            # 事件处理
│   └── handler.ts     # 机器人进群、消息撤回、菜单点击等事件
├── opencode/          # OpenCode SDK 集成（自动启动服务器）
├── session/           # 会话管理
├── commands/          # 命令系统
├── auth/              # 认证/授权
├── utils/             # 工具函数（日志、重连）
└── __tests__/         # 测试文件
```

## 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   飞书客户端    │────▶│   会话管理器    │────▶│  OpenCode客户端 │
│  (WebSocket)    │     │                 │     │  (自动启动服务) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   消息处理器    │     │     数据库      │     │    事件流       │
│                 │     │    (SQLite)     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│   命令处理器    │                           │   卡片流式器    │
│                 │                           │                 │
└─────────────────┘                           └─────────────────┘
```

## 飞书应用配置

1. 访问[飞书开放平台](https://open.feishu.cn/app)
2. 创建新的企业应用
3. 启用以下权限：
   - `im:message` - 发送消息
   - `im:message.receive_v1` - 接收消息
   - `im:chat` - 创建和管理群聊（**会话群功能必需**）
   - `im:chat:readonly` - 获取群信息
4. 在事件订阅中启用"长连接"模式，并订阅以下事件：
   - `im.message.receive_v1` - 接收消息
   - `im.chat.member.bot.added_v1` - 机器人进群
   - `im.chat.member.bot.deleted_v1` - 机器人被移出群
   - `im.chat.member.user.deleted_v1` - 用户退群（**会话群功能必需**）
   - `im.chat.disbanded_v1` - 群解散（**会话群功能必需**）
   - `im.message.recalled_v1` - 消息撤回
   - `application.bot.menu_v6` - 机器人菜单点击
5. （可选）配置机器人菜单：
   - 进入 机器人 > 机器人菜单
   - 添加菜单项（名称和 event_key）：
     | 菜单名称 | event_key |
     |---------|-----------|
     | 新建会话 | `new_session` |
     | 切换模型 | `switch_model` |
     | 压缩上下文 | `compact` |
     | 清除历史 | `clear_history` |
     | 查看状态 | `show_status` |
6. 将机器人添加到你的飞书工作区

## 故障排除

### 机器人收不到消息
- 确保在飞书应用设置中启用了长连接
- 检查所有必需权限是否已授予
- 验证 `.env` 中的应用凭证
- 确认已订阅所需的事件

### 无法创建会话群
- 确认已授予 `im:chat` 权限
- 确认应用已发布并通过审核
- 检查机器人是否有创建群聊的能力

### 会话群内消息无响应
- 确认群组是通过 `/new` 命令创建的会话群
- 普通群组需要 @机器人 才能触发响应
- 检查数据库中是否有该群的会话记录

### 权限被拒绝（白名单模式）
- 确认 `ALLOW_ALL_USERS` 是否设为 `false`
- 验证用户是管理员或已加入白名单
- 作为管理员使用 `/whitelist_add <用户ID>` 授予访问权限

### 消息撤回不生效
- 确认已订阅 `im.message.recalled_v1` 事件
- 机器人只能撤回 24 小时内发送的消息

## 许可证

MIT
