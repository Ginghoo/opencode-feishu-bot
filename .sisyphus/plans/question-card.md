# OpenCode Question 卡片交互功能

## TL;DR

> **Quick Summary**: 实现 OpenCode AI 向用户提问时的飞书卡片交互功能，支持单选（按钮/下拉）、多选（下拉）和文字自定义回复。
> 
> **Deliverables**:
> - 问题卡片生成器 (`src/feishu/question-card.ts`)
> - 问题事件处理 (`src/session/manager.ts` 扩展)
> - 卡片交互回调处理 (`src/events/handler.ts` 扩展)
> - 文字回复处理逻辑
> - 单元测试
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request
用户希望在飞书机器人中支持 OpenCode 的 Question 功能 - 当 AI 需要用户做出选择时，发送一张交互式卡片让用户选择答案。

### Interview Summary
**Key Discussions**:
- 展示方式：新发独立卡片（不融入流式响应卡片）
- 单选：智能切换 - ≤3选项用按钮，>3选项用下拉
- 多选：用下拉框（飞书不支持原生 checkbox）
- 自定义答案：始终支持文字回复
- 视觉风格：突出显示（橙色标题栏）
- 超时：无超时限制
- 文字消息：有待回复问题时优先视为答案

**Research Findings**:
- 飞书卡片支持：`button`, `select_static`, `select_person`
- 不支持：checkbox, multi-select
- OpenCode SDK: `question.asked` 事件, `client.question.reply()` API
- 现有卡片交互处理模式在 `src/events/handler.ts`

### Metis Review
**Identified Gaps** (addressed):
- 状态存储：使用内存存储（activeSessions Map 扩展）
- 多问题：单卡片显示所有问题
- 卡片更新：文字回答后更新卡片为已回答状态
- 命令冲突：命令优先执行，自动拒绝待回复问题
- Skip 按钮：暂不添加，保持简单

---

## Work Objectives

### Core Objective
实现 `question.asked` 事件处理和交互式问题卡片，让用户能通过点击按钮/下拉选择或发送文字来回答 AI 的问题。

### Concrete Deliverables
- `src/feishu/question-card.ts` - 问题卡片构建函数
- `src/session/manager.ts` - 扩展处理 `question.asked` 事件和待回复状态
- `src/events/handler.ts` - 扩展处理问题卡片交互回调
- `src/opencode/client.ts` - 添加 `replyQuestion()` 和 `rejectQuestion()` 方法
- `src/__tests__/question-card.test.ts` - 卡片构建测试
- `src/__tests__/question-handler.test.ts` - 事件处理测试

### Definition of Done
- [ ] `bun test` 所有测试通过
- [ ] 收到 `question.asked` 事件时能正确发送问题卡片
- [ ] 点击按钮/选择下拉后能正确提交答案
- [ ] 发送文字消息时（有待回复问题）能正确提交自定义答案
- [ ] 提交后卡片更新为已回答状态

### Must Have
- 单选按钮组（≤3 选项）
- 单选下拉（>3 选项）
- 多选下拉
- 文字消息作为自定义答案
- 已回答状态卡片更新

### Must NOT Have (Guardrails)
- 不添加问题超时逻辑
- 不添加 Skip/拒绝按钮
- 不添加问题历史记录功能
- 不修改现有流式响应卡片逻辑
- 不创建抽象工厂或复杂状态管理
- 不添加数据库持久化（仅内存）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **User wants tests**: YES (自动化测试)
- **Framework**: bun test

### Test Structure
每个 TODO 包含具体的测试用例和验证命令。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: 创建问题卡片构建器
└── Task 2: 扩展 OpenCode 客户端 API

Wave 2 (After Wave 1):
├── Task 3: 扩展 SessionManager 处理问题事件
└── Task 4: 扩展事件处理器处理卡片交互

Wave 3 (After Wave 2):
└── Task 5: 集成测试和边界情况处理

Critical Path: Task 1 → Task 3 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 5 | 4 |
| 4 | 1, 2 | 5 | 3 |
| 5 | 3, 4 | None | None (final) |

---

## TODOs

- [ ] 1. 创建问题卡片构建器

  **What to do**:
  - 创建 `src/feishu/question-card.ts`
  - 实现 `createQuestionCard(request: QuestionRequest)` 函数
  - 实现单选按钮组（≤3选项）
  - 实现单选下拉（>3选项）
  - 实现多选下拉
  - 实现已回答状态卡片 `createAnsweredCard()`
  - 添加提示文字："💬 或直接发送消息输入自定义答案"

  **Must NOT do**:
  - 不实现 checkbox 模拟（用下拉代替）
  - 不添加 Skip 按钮

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单文件创建，模式清晰，参考现有 menu.ts
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 卡片 UI 构建

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/feishu/menu.ts:78-114` - `createModelSelectCard()` 下拉选择器实现模式
  - `src/feishu/menu.ts:162-193` - `createConfirmCard()` 按钮组实现模式
  - `src/feishu/menu.ts:8-20` - `createHeader()` 和 `createMarkdown()` helper 函数

  **API/Type References**:
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:493-526` - `QuestionRequest`, `QuestionInfo`, `QuestionOption` 类型定义

  **Test References**:
  - `src/__tests__/formatter.test.ts` - 卡片构建测试模式

  **Acceptance Criteria**:

  ```typescript
  // src/__tests__/question-card.test.ts
  import { describe, test, expect } from 'bun:test';
  import { createQuestionCard, createAnsweredCard } from '../feishu/question-card';

  describe('createQuestionCard', () => {
    test('renders buttons for ≤3 options (single select)', () => {
      const request = {
        id: 'req-1',
        sessionID: 'ses-1',
        questions: [{
          question: '选择认证方式？',
          header: '认证方式',
          options: [
            { label: 'OAuth', description: 'OAuth 2.0 认证' },
            { label: 'JWT', description: 'JWT Token' },
          ],
          multiple: false,
        }],
      };
      const card = createQuestionCard(request);
      
      // 验证包含 button 元素
      const json = JSON.stringify(card);
      expect(json).toContain('"tag":"button"');
      expect(json).toContain('OAuth');
      expect(json).toContain('JWT');
      expect(json).not.toContain('"tag":"select_static"');
    });

    test('renders dropdown for >3 options (single select)', () => {
      const request = {
        id: 'req-1',
        sessionID: 'ses-1',
        questions: [{
          question: '选择数据库？',
          header: '数据库',
          options: [
            { label: 'MySQL', description: '' },
            { label: 'PostgreSQL', description: '' },
            { label: 'SQLite', description: '' },
            { label: 'MongoDB', description: '' },
          ],
          multiple: false,
        }],
      };
      const card = createQuestionCard(request);
      
      const json = JSON.stringify(card);
      expect(json).toContain('"tag":"select_static"');
    });

    test('renders dropdown for multiple select', () => {
      const request = {
        id: 'req-1',
        sessionID: 'ses-1',
        questions: [{
          question: '选择功能？',
          header: '功能',
          options: [
            { label: '认证', description: '' },
            { label: '日志', description: '' },
          ],
          multiple: true,
        }],
      };
      const card = createQuestionCard(request);
      
      const json = JSON.stringify(card);
      expect(json).toContain('"tag":"select_static"');
    });

    test('includes custom answer hint', () => {
      const request = {
        id: 'req-1',
        sessionID: 'ses-1',
        questions: [{
          question: '问题',
          header: '标题',
          options: [{ label: 'A', description: '' }],
        }],
      };
      const card = createQuestionCard(request);
      
      const json = JSON.stringify(card);
      expect(json).toContain('直接发送消息');
    });
  });

  describe('createAnsweredCard', () => {
    test('shows answered state with green header', () => {
      const card = createAnsweredCard('选择认证方式？', 'OAuth');
      const json = JSON.stringify(card);
      expect(json).toContain('已回答');
      expect(json).toContain('green');
      expect(json).toContain('OAuth');
    });
  });
  ```

  **Verification Command**:
  ```bash
  bun test src/__tests__/question-card.test.ts
  # Expected: 5 tests pass
  ```

  **Commit**: YES
  - Message: `feat(feishu): add question card builder for OpenCode Question feature`
  - Files: `src/feishu/question-card.ts`, `src/__tests__/question-card.test.ts`
  - Pre-commit: `bun test src/__tests__/question-card.test.ts`

---

- [ ] 2. 扩展 OpenCode 客户端 API

  **What to do**:
  - 在 `src/opencode/client.ts` 添加 `replyQuestion(requestId, answers)` 方法
  - 在 `src/opencode/client.ts` 添加 `rejectQuestion(requestId)` 方法
  - answers 格式为 `string[][]`（每个问题的答案是 label 数组）

  **Must NOT do**:
  - 不修改现有方法
  - 不添加缓存逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的 API 方法添加，参考现有模式
  - **Skills**: []
    - 无特殊技能需求

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/opencode/client.ts:112-125` - `abortSession()` 方法实现模式（try-catch + 返回 boolean）

  **API/Type References**:
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/sdk.gen.d.ts:628-646` - `client.question.reply()` 和 `client.question.reject()` 方法签名

  **Acceptance Criteria**:

  ```typescript
  // 在 src/__tests__/opencode-client.test.ts 添加
  describe('Question API', () => {
    test('replyQuestion calls SDK with correct parameters', async () => {
      // Mock 测试
      const wrapper = new OpencodeWrapper(config);
      // ... setup mock
      
      const result = await wrapper.replyQuestion('req-123', [['OAuth']]);
      expect(result).toBe(true);
    });

    test('rejectQuestion calls SDK reject endpoint', async () => {
      const wrapper = new OpencodeWrapper(config);
      // ... setup mock
      
      const result = await wrapper.rejectQuestion('req-123');
      expect(result).toBe(true);
    });
  });
  ```

  **Verification Command**:
  ```bash
  bun test src/__tests__/opencode-client.test.ts --grep "Question"
  # Expected: 2 tests pass
  ```

  **Commit**: YES
  - Message: `feat(opencode): add replyQuestion and rejectQuestion methods`
  - Files: `src/opencode/client.ts`, `src/__tests__/opencode-client.test.ts`
  - Pre-commit: `bun test src/__tests__/opencode-client.test.ts`

---

- [ ] 3. 扩展 SessionManager 处理问题事件

  **What to do**:
  - 在 `ActiveSession` 类型中添加 `pendingQuestion?: PendingQuestion` 字段
  - 定义 `PendingQuestion` 类型：`{ requestId, messageId, questions, chatId }`
  - 在 `handleOpencodeEvent()` 添加 `case 'question.asked'` 处理
  - 收到问题事件时：创建问题卡片 → 发送 → 存储 pendingQuestion 状态
  - 修改 `processMessage()` 检查 pendingQuestion：
    - 如果有待回复问题，将消息视为自定义答案
    - 调用 `replyQuestion()` 提交
    - 更新卡片为已回答状态
    - 清除 pendingQuestion

  **Must NOT do**:
  - 不添加超时逻辑
  - 不添加数据库持久化
  - 不修改现有消息处理逻辑的主流程

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 中等复杂度，需要理解现有状态管理模式
  - **Skills**: []
    - 无特殊技能需求

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1, Task 2

  **References**:

  **Pattern References**:
  - `src/session/manager.ts:20-30` - `ActiveSession` 类型定义位置
  - `src/session/manager.ts:165-242` - `handleOpencodeEvent()` 事件处理模式
  - `src/session/manager.ts:60-120` - `processMessage()` 消息处理流程

  **API/Type References**:
  - `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:527-530` - `EventQuestionAsked` 事件结构

  **Acceptance Criteria**:

  ```typescript
  // src/__tests__/question-handler.test.ts
  describe('SessionManager question handling', () => {
    test('sends question card on question.asked event', async () => {
      // Setup mock feishuClient, opencodeClient
      const manager = new SessionManager(config);
      
      // Simulate question.asked event
      await manager.handleOpencodeEvent('chat-1', {
        type: 'question.asked',
        properties: {
          id: 'req-1',
          sessionID: 'ses-1',
          questions: [{
            question: '选择？',
            header: '选择',
            options: [{ label: 'A', description: '' }],
          }],
        },
      });
      
      // Verify card was sent
      expect(mockFeishuClient.sendCard).toHaveBeenCalled();
      // Verify pendingQuestion was stored
      expect(manager.getPendingQuestion('chat-1')).toBeDefined();
    });

    test('treats text message as answer when question pending', async () => {
      const manager = new SessionManager(config);
      // Setup pending question
      manager.setPendingQuestion('chat-1', { requestId: 'req-1', ... });
      
      // Send text message
      await manager.processMessage({
        chatId: 'chat-1',
        userId: 'user-1',
        content: '我的自定义答案',
        ...
      });
      
      // Verify replyQuestion was called
      expect(mockOpencodeClient.replyQuestion).toHaveBeenCalledWith('req-1', [['我的自定义答案']]);
      // Verify pendingQuestion was cleared
      expect(manager.getPendingQuestion('chat-1')).toBeUndefined();
    });
  });
  ```

  **Verification Command**:
  ```bash
  bun test src/__tests__/question-handler.test.ts
  # Expected: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(session): handle question.asked event and text answer submission`
  - Files: `src/session/manager.ts`, `src/__tests__/question-handler.test.ts`
  - Pre-commit: `bun test src/__tests__/question-handler.test.ts`

---

- [ ] 4. 扩展事件处理器处理卡片交互

  **What to do**:
  - 在 `src/events/handler.ts` 的 `onCardAction` 中添加 `case 'question_answer'` 处理
  - 从 `event.action.value` 提取 `requestId`, `questionIndex`, `answerIndex` 或 `selectedOption`
  - 按钮点击：直接提交单个答案
  - 下拉选择：从 `event.action.option` 获取选中值，提交答案
  - 调用 `opencodeClient.replyQuestion()` 提交
  - 更新卡片为已回答状态
  - 清除 sessionManager 中的 pendingQuestion

  **Must NOT do**:
  - 不添加确认对话框
  - 不添加多步骤提交流程

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的事件处理扩展，模式清晰
  - **Skills**: []
    - 无特殊技能需求

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1, Task 2

  **References**:

  **Pattern References**:
  - `src/events/handler.ts:192-248` - `onCardAction` 处理模式，`switch (actionType)` 结构
  - `src/events/handler.ts:203-238` - `switch_model` action 处理示例

  **API/Type References**:
  - `src/feishu/client.ts:85-95` - `CardActionEvent` 类型定义

  **Acceptance Criteria**:

  ```typescript
  // 在 src/__tests__/handler.test.ts 或新建测试文件
  describe('Card action: question_answer', () => {
    test('button click submits answer and updates card', async () => {
      // Setup
      const event: CardActionEvent = {
        eventId: 'evt-1',
        operatorId: 'user-1',
        chatId: 'chat-1',
        messageId: 'msg-1',
        action: {
          tag: 'button',
          value: { 
            action: 'question_answer',
            requestId: 'req-1',
            questionIndex: 0,
            answerLabel: 'OAuth',
          },
        },
      };
      
      await handleCardAction(event);
      
      expect(mockOpencodeClient.replyQuestion).toHaveBeenCalledWith('req-1', [['OAuth']]);
      expect(mockFeishuClient.updateCard).toHaveBeenCalled();
    });

    test('dropdown select submits answer', async () => {
      const event: CardActionEvent = {
        eventId: 'evt-1',
        operatorId: 'user-1',
        chatId: 'chat-1',
        messageId: 'msg-1',
        action: {
          tag: 'select_static',
          value: { 
            action: 'question_answer',
            requestId: 'req-1',
            questionIndex: 0,
          },
          option: 'MySQL',
        },
      };
      
      await handleCardAction(event);
      
      expect(mockOpencodeClient.replyQuestion).toHaveBeenCalledWith('req-1', [['MySQL']]);
    });
  });
  ```

  **Verification Command**:
  ```bash
  bun test src/__tests__/handler.test.ts --grep "question_answer"
  # Expected: 2 tests pass
  ```

  **Commit**: YES
  - Message: `feat(events): handle question card button/dropdown interactions`
  - Files: `src/events/handler.ts`, `src/__tests__/handler.test.ts`
  - Pre-commit: `bun test src/__tests__/handler.test.ts`

---

- [ ] 5. 集成测试和边界情况处理

  **What to do**:
  - 确保所有现有测试仍然通过
  - 添加边界情况处理：
    - 空选项数组（只有 custom=true）：显示纯文字提示卡片
    - `replyQuestion` 失败：显示错误卡片
    - 问题卡片被点击但 pendingQuestion 已不存在：显示"问题已过期"
  - 验证命令冲突处理：命令优先执行

  **Must NOT do**:
  - 不添加超时相关测试
  - 不添加性能测试

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 集成和边界情况处理
  - **Skills**: []
    - 无特殊技能需求

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 3, Task 4

  **References**:

  **Pattern References**:
  - `src/events/handler.ts:244-246` - 错误处理模式
  - `src/feishu/menu.ts:227-233` - `createErrorCard()` 错误卡片

  **Acceptance Criteria**:

  ```bash
  # 运行所有测试
  bun test
  # Expected: All tests pass (including new question-related tests)
  
  # 验证没有 TypeScript 错误
  bun run typecheck  # 或 npx tsc --noEmit
  # Expected: No errors
  ```

  **Edge Case Tests**:
  ```typescript
  describe('Question edge cases', () => {
    test('empty options shows text-only prompt', () => {
      const card = createQuestionCard({
        id: 'req-1',
        sessionID: 'ses-1',
        questions: [{
          question: '请输入您的想法',
          header: '自由输入',
          options: [],
          custom: true,
        }],
      });
      
      const json = JSON.stringify(card);
      expect(json).not.toContain('"tag":"button"');
      expect(json).not.toContain('"tag":"select_static"');
      expect(json).toContain('直接发送消息');
    });

    test('handles replyQuestion failure gracefully', async () => {
      mockOpencodeClient.replyQuestion.mockRejectedValue(new Error('Network error'));
      
      await handleCardAction(questionAnswerEvent);
      
      expect(mockFeishuClient.updateCard).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ header: expect.objectContaining({ template: 'red' }) })
      );
    });
  });
  ```

  **Commit**: YES
  - Message: `test(question): add integration tests and edge case handling`
  - Files: `src/__tests__/*.test.ts` (multiple files)
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(feishu): add question card builder` | question-card.ts, test | bun test question-card |
| 2 | `feat(opencode): add question API methods` | client.ts, test | bun test opencode-client |
| 3 | `feat(session): handle question events` | manager.ts, test | bun test question-handler |
| 4 | `feat(events): handle question card actions` | handler.ts, test | bun test handler |
| 5 | `test(question): integration and edge cases` | tests | bun test |

---

## Success Criteria

### Verification Commands
```bash
# 所有测试通过
bun test
# Expected: All tests pass

# TypeScript 类型检查
bunx tsc --noEmit
# Expected: No errors
```

### Final Checklist
- [ ] 收到 `question.asked` 事件时发送问题卡片
- [ ] 单选 ≤3 选项显示按钮组
- [ ] 单选 >3 选项显示下拉
- [ ] 多选显示下拉
- [ ] 点击按钮/选择下拉后提交答案
- [ ] 文字消息在有待回复问题时作为自定义答案提交
- [ ] 提交后卡片更新为已回答状态（绿色标题）
- [ ] 所有现有测试仍然通过
