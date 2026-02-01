import { describe, test, expect, mock } from 'bun:test';
import { CardBuilder } from '../../channels/feishu/card-builder';
import type { UnifiedReply, ContentBlock } from '../../types/message';

describe('CardBuilder', () => {
  const builder = new CardBuilder();

  test('should build card with text block', () => {
    const reply: UnifiedReply = {
      status: 'completed',
      blocks: [{ type: 'text', content: 'Hello world' }],
    };

    const card = builder.buildFromReply(reply);

    expect(card.header?.template).toBe('green');
    expect(card.elements).toHaveLength(1);
    expect(card.elements[0]!.tag).toBe('markdown');
    expect(card.elements[0]!.content).toBe('Hello world');
  });

  test('should build card with code block', () => {
    const reply: UnifiedReply = {
      status: 'completed',
      blocks: [{ type: 'code', language: 'typescript', content: 'const x = 1;' }],
    };

    const card = builder.buildFromReply(reply);

    expect(card.elements[0]!.content).toContain('```typescript');
    expect(card.elements[0]!.content).toContain('const x = 1;');
  });

  test('should build card with tool_call block', () => {
    const reply: UnifiedReply = {
      status: 'streaming',
      blocks: [{ type: 'tool_call', toolName: 'read_file', status: 'running' }],
    };

    const card = builder.buildFromReply(reply);

    expect(card.header?.template).toBe('blue');
    expect(card.elements[0]!.text?.content).toContain('read_file');
    expect(card.elements[0]!.text?.content).toContain('🔄');
  });

  test('should build card with error block', () => {
    const reply: UnifiedReply = {
      status: 'error',
      blocks: [{ type: 'error', message: 'Something went wrong' }],
    };

    const card = builder.buildFromReply(reply);

    expect(card.header?.template).toBe('red');
    expect(card.elements[0]!.text?.content).toContain('错误');
    expect(card.elements[0]!.text?.content).toContain('Something went wrong');
  });

  test('should build card with multiple blocks', () => {
    const reply: UnifiedReply = {
      status: 'completed',
      blocks: [
        { type: 'text', content: 'Starting...' },
        { type: 'tool_call', toolName: 'search', status: 'completed' },
        { type: 'text', content: 'Done!' },
      ],
    };

    const card = builder.buildFromReply(reply);

    expect(card.elements).toHaveLength(3);
  });

  test('should handle empty blocks', () => {
    const reply: UnifiedReply = {
      status: 'pending',
      blocks: [],
    };

    const card = builder.buildFromReply(reply);

    expect(card.elements.length).toBeGreaterThan(0);
  });

  test('should truncate long thinking content', () => {
    const longThinking = 'a'.repeat(500);
    const reply: UnifiedReply = {
      status: 'streaming',
      blocks: [{ type: 'thinking', content: longThinking }],
    };

    const card = builder.buildFromReply(reply);
    const content = card.elements[0]!.text?.content ?? '';
    
    expect(content.length).toBeLessThan(longThinking.length);
    expect(content).toContain('...');
  });
});
