/**
 * 飞书卡片格式化模块
 * 提供卡片构建和内容格式化功能
 */

/** 卡片模板颜色 */
export type CardTemplate = 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey';

/** 卡片标题 */
export interface CardHeader {
  title: {
    tag: 'plain_text';
    content: string;
  };
  template?: CardTemplate;
}

/** 飞书卡片结构 */
export interface FeishuCard {
  config?: {
    wide_screen_mode?: boolean;
  };
  header?: CardHeader;
  elements: CardElement[];
}

export type CardElement = MarkdownElement | DivElement | HrElement | NoteElement;

export interface MarkdownElement {
  tag: 'markdown';
  content: string;
}

export interface DivElement {
  tag: 'div';
  text: {
    tag: 'plain_text' | 'lark_md';
    content: string;
  };
}

export interface HrElement {
  tag: 'hr';
}

export interface NoteElement {
  tag: 'note';
  elements: Array<{
    tag: 'plain_text' | 'lark_md';
    content: string;
  }>;
}

// 卡片内容最大长度（飞书限制）
const MAX_CARD_CONTENT_LENGTH = 28000;
const TRUNCATION_SUFFIX = '\n\n... (内容已截断)';

/** 创建卡片 */
export function createCard(content: string, title?: string, template?: CardTemplate): FeishuCard {
  const truncatedContent = truncateContent(content);
  
  const card: FeishuCard = {
    config: { wide_screen_mode: true },
    elements: [{
      tag: 'markdown',
      content: truncatedContent,
    }],
  };

  if (title) {
    card.header = {
      title: { tag: 'plain_text', content: title },
      template: template ?? 'blue',
    };
  }

  return card;
}

/** 创建状态卡片 */
export function createStatusCard(status: string, details?: string): FeishuCard {
  let template: CardTemplate = 'blue';
  
  if (status.includes('error') || status.includes('Error') || status.includes('错误')) {
    template = 'red';
  } else if (status.includes('complete') || status.includes('Complete') || status.includes('done') || status.includes('完成')) {
    template = 'green';
  } else if (status.includes('running') || status.includes('Running') || status.includes('processing') || status.includes('处理中')) {
    template = 'wathet';
  }

  const elements: CardElement[] = [{
    tag: 'markdown',
    content: details ?? status,
  }];

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: status },
      template,
    },
    elements,
  };
}

/** 格式化代码块 */
export function formatCodeBlock(code: string, language?: string): string {
  const lang = language ?? '';
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/** 格式化工具输出 */
export function formatToolOutput(toolName: string, status: string, output?: string): string {
  const statusEmoji = getStatusEmoji(status);
  let result = `**${statusEmoji} ${toolName}**`;
  
  if (output) {
    const truncatedOutput = output.length > 2000 
      ? output.slice(0, 2000) + '... (输出已截断)'
      : output;
    result += `\n${formatCodeBlock(truncatedOutput)}`;
  }
  
  return result;
}

import { resolve, isAbsolute } from 'node:path';

function isPathKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return lowerKey.includes('path') || lowerKey.includes('file') || lowerKey === 'workdir';
}

function ensureAbsolutePath(value: string): string {
  if (isAbsolute(value)) {
    return value;
  }
  return resolve(process.cwd(), value);
}

function formatToolInput(input: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    
    let displayValue: string;
    if (typeof value === 'string') {
      let processedValue = value;
      if (isPathKey(key) && value.trim()) {
        processedValue = ensureAbsolutePath(value);
      }
      displayValue = processedValue.length > 100 ? processedValue.slice(0, 100) + '...' : processedValue;
    } else {
      displayValue = JSON.stringify(value);
      if (displayValue.length > 100) {
        displayValue = displayValue.slice(0, 100) + '...';
      }
    }
    lines.push(`**${key}**: \`${displayValue}\``);
  }
  return lines.join('\n');
}

function escapeCodeBlockContent(text: string): string {
  return text.replace(/```/g, '` ` `');
}

function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
    case 'pending':
      return '⏳';
    case 'completed':
    case 'complete':
    case 'success':
      return '✅';
    case 'error':
    case 'failed':
      return '❌';
    default:
      return '🔧';
  }
}

/** 格式化思考块 */
export function formatThinkingBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  const lines = trimmed.split('\n');
  const maxLines = 5;
  const maxLineLength = 80;
  
  const formattedLines = lines.slice(0, maxLines).map(line => {
    const truncatedLine = line.length > maxLineLength 
      ? line.slice(0, maxLineLength) + '...' 
      : line;
    return `> ${truncatedLine}`;
  });
  
  if (lines.length > maxLines) {
    formattedLines.push(`> *... 还有 ${lines.length - maxLines} 行*`);
  }
  
  return formattedLines.join('\n');
}

/** 格式化错误信息 */
export function formatError(error: string): string {
  return `**❌ 错误**\n${formatCodeBlock(error)}`;
}

/** 截断内容以符合飞书限制 */
export function truncateContent(content: string): string {
  if (content.length <= MAX_CARD_CONTENT_LENGTH) {
    return content;
  }
  
  const availableLength = MAX_CARD_CONTENT_LENGTH - TRUNCATION_SUFFIX.length;
  return content.slice(0, availableLength) + TRUNCATION_SUFFIX;
}

/** 转义 Markdown 特殊字符 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

/** 格式化消息部分 */
export function formatMessageParts(parts: Array<{ type: string; text?: string; name?: string; state?: string; output?: string }>): string {
  const formattedParts: string[] = [];

  for (const part of parts) {
    switch (part.type) {
      case 'text':
        if (part.text) {
          formattedParts.push(part.text);
        }
        break;
      
      case 'reasoning':
        if (part.text) {
          formattedParts.push(formatThinkingBlock(part.text));
        }
        break;
      
      case 'tool-call':
        if (part.name) {
          formattedParts.push(formatToolOutput(
            part.name,
            part.state ?? 'pending',
            part.output
          ));
        }
        break;
    }
  }

  return formattedParts.join('\n\n');
}

export interface StreamingCardParts {
  textContent: string;
  reasoningContent: string;
  toolCalls: Array<{
    name: string;
    state: string;
    title?: string;
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
  }>;
}

export interface OrderedPart {
  type: 'text' | 'reasoning' | 'tool-call';
  text?: string;
  name?: string;
  state?: string;
  title?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}

export function categorizeMessageParts(parts: Array<{ type: string; text?: string; name?: string; state?: string; title?: string; input?: Record<string, unknown>; output?: string; error?: string }>): StreamingCardParts {
  const result: StreamingCardParts = {
    textContent: '',
    reasoningContent: '',
    toolCalls: [],
  };

  const textParts: string[] = [];
  const reasoningParts: string[] = [];

  for (const part of parts) {
    switch (part.type) {
      case 'text':
        if (part.text) textParts.push(part.text);
        break;
      case 'reasoning':
        if (part.text) reasoningParts.push(part.text);
        break;
      case 'tool-call':
        if (part.name) {
          result.toolCalls.push({
            name: part.name,
            state: part.state ?? 'pending',
            title: part.title,
            input: part.input,
            output: part.output,
            error: part.error,
          });
        }
        break;
    }
  }

  result.textContent = textParts.join('\n\n');
  result.reasoningContent = reasoningParts.join('\n\n');
  return result;
}

interface PartGroup {
  type: 'reasoning' | 'tool-call' | 'text';
  parts: OrderedPart[];
}

function groupConsecutiveParts(parts: OrderedPart[]): PartGroup[] {
  const groups: PartGroup[] = [];
  
  for (const part of parts) {
    const lastGroup = groups[groups.length - 1];
    
    if (lastGroup && lastGroup.type === part.type) {
      lastGroup.parts.push(part);
    } else {
      groups.push({
        type: part.type,
        parts: [part],
      });
    }
  }
  
  return groups;
}

function estimateElementSize(element: object): number {
  return JSON.stringify(element).length;
}

const MAX_CARD_SIZE = 25000;
const MAX_REASONING_LENGTH = 3000;
const MAX_TOOL_OUTPUT_LENGTH = 5000;

interface CardBuildResult {
  cards: object[];
  hasMore: boolean;
}

export function buildStreamingCardsV2(
  parts: OrderedPart[],
  isComplete: boolean,
  title?: string
): CardBuildResult {
  const groups = groupConsecutiveParts(parts);
  const cards: object[] = [];
  let currentElements: object[] = [];
  let currentSize = 0;
  let cardIndex = 0;
  let reasoningIndex = 0;
  
  const createCard = (elements: object[], isFinal: boolean): object => {
    const template = isFinal && isComplete ? 'green' : 'wathet';
    const headerTitle = title ?? (isFinal && isComplete ? '响应完成' : '处理中...');
    const cardTitle = cardIndex > 0 ? `${headerTitle} (续${cardIndex})` : headerTitle;
    
    return {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: cardTitle },
        template,
      },
      body: { elements },
    };
  };
  
  const flushCard = () => {
    if (currentElements.length > 0) {
      cards.push(createCard(currentElements, false));
      cardIndex++;
      currentElements = [];
      currentSize = 0;
    }
  };
  
  const addElement = (element: object) => {
    const elementSize = estimateElementSize(element);
    
    if (currentSize + elementSize > MAX_CARD_SIZE && currentElements.length > 0) {
      flushCard();
    }
    
    currentElements.push(element);
    currentSize += elementSize;
  };
  
  for (const group of groups) {
    switch (group.type) {
      case 'reasoning': {
        reasoningIndex++;
        const reasoningTexts = group.parts
          .map(p => p.text)
          .filter((t): t is string => !!t);
        
        if (reasoningTexts.length === 0) break;
        
        let combinedText = reasoningTexts.join('\n\n');
        if (combinedText.length > MAX_REASONING_LENGTH) {
          combinedText = combinedText.slice(0, MAX_REASONING_LENGTH) + '\n... (思考内容已截断)';
        }
        
        const panelTitle = groups.filter(g => g.type === 'reasoning').length > 1
          ? `💭 思考过程 ${reasoningIndex}`
          : '💭 思考过程';
        
        addElement({
          tag: 'collapsible_panel',
          expanded: false,
          header: {
            title: { tag: 'plain_text', content: panelTitle },
          },
          elements: [{
            tag: 'markdown',
            content: '```\n' + escapeCodeBlockContent(combinedText) + '\n```',
          }],
        });
        break;
      }
      
      case 'tool-call': {
        for (const tool of group.parts) {
          if (!tool.name) continue;
          
          const emoji = getStatusEmoji(tool.state ?? 'pending');
          const toolElements: object[] = [];
          
          if (tool.input && Object.keys(tool.input).length > 0) {
            const inputLines = formatToolInput(tool.input);
            if (inputLines) {
              toolElements.push({
                tag: 'markdown',
                content: inputLines,
              });
            }
          }
          
          if (tool.error) {
            toolElements.push({
              tag: 'markdown',
              content: `**错误：**\n\`\`\`\n${escapeCodeBlockContent(tool.error)}\n\`\`\``,
            });
          } else if (tool.output) {
            let outputText = tool.output;
            if (outputText.length > MAX_TOOL_OUTPUT_LENGTH) {
              outputText = outputText.slice(0, MAX_TOOL_OUTPUT_LENGTH) + '\n... (输出已截断)';
            }
            toolElements.push({
              tag: 'markdown',
              content: '```\n' + escapeCodeBlockContent(outputText) + '\n```',
            });
          }
          
          const panelTitle = tool.title || tool.name;
          
          addElement({
            tag: 'collapsible_panel',
            expanded: false,
            header: {
              title: { tag: 'plain_text', content: `${emoji} ${panelTitle}` },
            },
            elements: toolElements.length > 0 ? toolElements : [{
              tag: 'markdown',
              content: '*执行中...*',
            }],
          });
        }
        break;
      }
      
      case 'text': {
        const textContents = group.parts
          .map(p => p.text)
          .filter((t): t is string => !!t);
        
        if (textContents.length === 0) break;
        
        if (currentElements.length > 0) {
          addElement({ tag: 'hr' });
        }
        
        const combinedText = textContents.join('\n\n');
        addElement({
          tag: 'markdown',
          content: truncateContent(combinedText),
        });
        break;
      }
    }
  }
  
  if (currentElements.length === 0) {
    currentElements.push({
      tag: 'markdown',
      content: isComplete ? '（无内容）' : '...',
    });
  }
  
  cards.push(createCard(currentElements, true));
  
  return { cards, hasMore: false };
}

export function buildStreamingCardV2(
  parts: StreamingCardParts,
  isComplete: boolean,
  title?: string
): object {
  const orderedParts: OrderedPart[] = [];
  
  if (parts.reasoningContent) {
    orderedParts.push({ type: 'reasoning', text: parts.reasoningContent });
  }
  
  for (const tool of parts.toolCalls) {
    orderedParts.push({
      type: 'tool-call',
      name: tool.name,
      state: tool.state,
      title: tool.title,
      input: tool.input,
      output: tool.output,
      error: tool.error,
    });
  }
  
  if (parts.textContent) {
    orderedParts.push({ type: 'text', text: parts.textContent });
  }
  
  const result = buildStreamingCardsV2(orderedParts, isComplete, title);
  return result.cards[0] ?? {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: title ?? '处理中...' },
      template: 'wathet',
    },
    body: {
      elements: [{ tag: 'markdown', content: '...' }],
    },
  };
}

/** 构建流式卡片 */
export function buildStreamingCard(
  content: string,
  isComplete: boolean,
  title?: string
): FeishuCard {
  const template: CardTemplate = isComplete ? 'green' : 'wathet';
  const headerTitle = title ?? (isComplete ? '响应完成' : '处理中...');
  
  return createCard(content, headerTitle, template);
}
