# 飞书卡片消息重设计方案

## 当前问题

### 1. 用户消息混入响应卡片
- `message.part.updated` 事件可能包含 `synthetic` 或用户相关的 part
- 当前代码没有过滤，导致用户输入可能出现在 AI 响应卡片中

### 2. 思考内容展示差
- 当前使用 `> blockquote` 格式，在飞书中显示效果一般
- 多行内容被截断，信息丢失严重
- 没有利用飞书 markdown 的代码块能力

### 3. 工具调用展示差
- 仅显示工具名称和状态 emoji
- 丢失了丰富的上下文信息（title、input、output）
- 状态变化不直观

### 4. 单卡片塞入所有内容
- 所有内容混在一起，层次不清
- 长响应时难以阅读

---

## 飞书卡片 Markdown 支持

飞书卡片 markdown 元素支持：
- **粗体**: `**text**`
- *斜体*: `*text*`
- ~~删除线~~: `~~text~~`
- `行内代码`: `` `code` ``
- 代码块: ` ```language\ncode\n``` `
- 链接: `[text](url)`
- 列表: `- item` 或 `1. item`
- 标题: `# ## ###`
- 分割线: `---`

**注意**: 飞书不支持折叠/展开组件，所有内容会直接展示。

---

## 新设计方案

### 核心原则

1. **只展示 AI 响应** - 过滤掉用户消息 parts
2. **信息分层** - 主响应突出，辅助信息收起
3. **利用代码块** - 思考和工具调用用代码块展示
4. **状态可视化** - 清晰的处理状态指示

### 卡片结构

```
┌─────────────────────────────────────────────┐
│ [Header] 处理中... / 响应完成    [wathet/green] │
├─────────────────────────────────────────────┤
│                                             │
│ [主响应内容 - Text Parts]                    │
│ AI 的文字回复，支持完整 markdown 渲染         │
│                                             │
├─────────────────────────────────────────────┤
│ [思考过程 - Reasoning Parts] (如有)          │
│ ```thinking                                 │
│ AI 的思考内容，保留完整上下文                 │
│ 使用代码块避免格式冲突                       │
│ ```                                         │
├─────────────────────────────────────────────┤
│ [工具调用 - Tool Parts] (如有)               │
│                                             │
│ **⏳ read_file** `src/index.ts`             │
│ **✅ edit_file** `修改了 15 行`              │
│ **❌ bash** `命令执行失败`                   │
│                                             │
│ <展开查看详情 - 代码块>                      │
│ ```json                                     │
│ { "input": {...}, "output": "..." }         │
│ ```                                         │
│                                             │
└─────────────────────────────────────────────┘
```

### Part 类型处理

#### 1. Text Part (主响应)
```markdown
[直接渲染文本内容]
支持完整 markdown：代码块、列表、链接等
这是用户最关心的内容，放在最前面
```

#### 2. Reasoning Part (思考过程)
```markdown
---
**思考过程**
```thinking
[完整思考内容，不截断]
使用 thinking 语言标识，视觉上区分
飞书会渲染为灰色代码块
```
```

**设计考虑**:
- 使用代码块而非引用块，避免特殊字符破坏格式
- 完整展示思考内容，不过度截断
- 放在主响应之后，不喧宾夺主

#### 3. Tool Part (工具调用)
```markdown
---
**工具调用**

**⏳ read_file** 读取文件
**✅ edit_file** 修改了 src/index.ts (15 行)
**❌ bash** 执行失败: command not found

<详细信息>
```json
{
  "tool": "edit_file",
  "input": { "path": "src/index.ts", ... },
  "output": "Successfully edited..."
}
```
```

**设计考虑**:
- 摘要行：emoji + 工具名 + title（如有）
- 详细信息用 JSON 代码块，可选展示
- 只展示完成/错误的工具详情，pending/running 只显示状态

### 过滤逻辑

```typescript
// 只处理 assistant 消息的 parts
function shouldIncludePart(part: Part): boolean {
  // 过滤 synthetic parts（通常是用户输入的回显）
  if (part.synthetic === true) return false;
  
  // 过滤被忽略的 parts
  if (part.ignored === true) return false;
  
  // 只处理这些类型
  const allowedTypes = ['text', 'reasoning', 'tool'];
  return allowedTypes.includes(part.type);
}
```

### 状态管理

```typescript
interface CardState {
  status: 'thinking' | 'processing' | 'complete' | 'error';
  textParts: TextPart[];
  reasoningParts: ReasoningPart[];
  toolParts: ToolPart[];
}

// 卡片标题根据状态变化
function getCardTitle(state: CardState): string {
  switch (state.status) {
    case 'thinking': return '思考中...';
    case 'processing': return '处理中...';
    case 'complete': return '响应完成';
    case 'error': return '发生错误';
  }
}

// 卡片颜色
function getCardTemplate(state: CardState): CardTemplate {
  switch (state.status) {
    case 'thinking': return 'wathet';
    case 'processing': return 'blue';
    case 'complete': return 'green';
    case 'error': return 'red';
  }
}
```

---

## 格式化函数设计

### formatTextPart
```typescript
function formatTextPart(text: string): string {
  // 直接返回，保留原始 markdown
  return text;
}
```

### formatReasoningPart
```typescript
function formatReasoningPart(text: string): string {
  // 使用代码块包裹，避免格式冲突
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  return `---\n**思考过程**\n\`\`\`thinking\n${trimmed}\n\`\`\``;
}
```

### formatToolPart
```typescript
function formatToolPart(tool: ToolPart): string {
  const { tool: name, state } = tool;
  const emoji = getStatusEmoji(state.status);
  const title = state.title ?? name;
  
  let result = `**${emoji} ${name}** ${title}`;
  
  // 完成或错误时显示详情
  if (state.status === 'completed' || state.status === 'error') {
    const detail = state.status === 'completed' 
      ? state.output 
      : state.error;
    
    if (detail && detail.length < 500) {
      result += `\n\`\`\`\n${detail}\n\`\`\``;
    }
  }
  
  return result;
}
```

### 组合渲染
```typescript
function renderCard(state: CardState): string {
  const sections: string[] = [];
  
  // 1. 主响应 (Text)
  const textContent = state.textParts
    .map(p => formatTextPart(p.text))
    .join('\n\n');
  if (textContent) {
    sections.push(textContent);
  }
  
  // 2. 思考过程 (Reasoning) - 合并为一个块
  if (state.reasoningParts.length > 0) {
    const allReasoning = state.reasoningParts
      .map(p => p.text.trim())
      .join('\n\n');
    sections.push(formatReasoningPart(allReasoning));
  }
  
  // 3. 工具调用 (Tool)
  if (state.toolParts.length > 0) {
    const toolsContent = state.toolParts
      .map(formatToolPart)
      .join('\n\n');
    sections.push(`---\n**工具调用**\n\n${toolsContent}`);
  }
  
  return sections.join('\n\n');
}
```

---

## 实现计划

### 阶段 1: 重构 formatter.ts
- [ ] 新增 `formatReasoningPart` - 代码块格式
- [ ] 新增 `formatToolPart` - 工具详情格式
- [ ] 重写 `formatMessageParts` - 分层组合渲染

### 阶段 2: 修改 manager.ts
- [ ] 新增 part 过滤逻辑 (`shouldIncludePart`)
- [ ] 分类存储不同类型的 parts
- [ ] 优化状态判断逻辑

### 阶段 3: 更新 streamer.ts
- [ ] 支持状态驱动的标题/颜色
- [ ] 优化节流策略

### 阶段 4: 测试
- [ ] 更新单元测试
- [ ] 端到端验证

---

## 示例效果

### 简单文本响应
```
┌─────────────────────────────────────────────┐
│ 响应完成                              [green] │
├─────────────────────────────────────────────┤
│                                             │
│ 这是一个简单的文本响应。                     │
│                                             │
│ 支持 **markdown** 格式：                    │
│ - 列表项 1                                  │
│ - 列表项 2                                  │
│                                             │
│ ```javascript                               │
│ console.log('代码块也正常渲染');             │
│ ```                                         │
│                                             │
└─────────────────────────────────────────────┘
```

### 包含思考的响应
```
┌─────────────────────────────────────────────┐
│ 响应完成                              [green] │
├─────────────────────────────────────────────┤
│                                             │
│ 根据分析，建议采用方案 A。                   │
│                                             │
│ ---                                         │
│ **思考过程**                                │
│ ```thinking                                 │
│ 用户需要在 A 和 B 之间做选择...              │
│ A 的优点是性能好，缺点是实现复杂...          │
│ B 的优点是简单，缺点是性能一般...            │
│ 综合考虑，A 更适合这个场景...                │
│ ```                                         │
│                                             │
└─────────────────────────────────────────────┘
```

### 包含工具调用的响应
```
┌─────────────────────────────────────────────┐
│ 处理中...                             [blue] │
├─────────────────────────────────────────────┤
│                                             │
│ 正在修改文件...                             │
│                                             │
│ ---                                         │
│ **工具调用**                                │
│                                             │
│ **✅ read_file** 读取 src/index.ts          │
│ **⏳ edit_file** 修改文件中...               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 待确认问题

1. **思考内容长度**: 是否需要限制最大长度？建议 2000 字符
2. **工具详情**: 默认显示还是折叠？飞书不支持折叠，建议短内容显示，长内容截断
3. **多卡片 vs 单卡片**: 是否需要拆分为多个卡片？建议单卡片，避免消息碎片化
4. **实时更新频率**: 当前 500ms 节流是否合适？

请审阅后告知是否需要调整设计。
