---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## 项目架构要点

### OpenCode directory 参数传递

`OpencodeWrapper` 的所有 API 调用（`createSession`、`sendPrompt`、`subscribeToEvents`、`abortSession`、`summarizeSession` 等）都需要 `directory` 查询参数来指定项目目录。

- `this.directory` 是构造时设置的**默认值**，各方法均支持 `directory?: string` 可选参数来覆盖
- `OpencodeAgent` 通过 `sessionProjects` Map 维护每个 session 的实际 projectPath，调用 wrapper 方法时必须传入
- 如果新增 wrapper 方法涉及 OpenCode API 调用，务必添加 `directory` 可选参数并传递给 `query.directory`

### config.toml 中 OpenCode 连接方式

- `[opencode] port = 4096`：bot 自行启动 OpenCode 服务器（独立模式）
- `[opencode] url = "http://127.0.0.1:4096"`：连接已有的 OpenCode 服务器（桌面应用模式）
- 使用 `url` 模式时，确保外部 OpenCode 进程已在运行；杀掉旧 bot 进程可能连带关闭其启动的 OpenCode 服务器

### 重启 bot 注意事项

- 重启前用 `ps aux | grep 'bun.*index\.ts'` 检查并杀掉所有旧进程
- 飞书 WebSocket 同一时间只有一个连接能收到消息，多个 bot 实例会导致旧实例抢消息、新实例收不到
- 独立模式下端口被占用会导致启动失败（日志只显示空的 `致命错误 {}`），需先释放端口
