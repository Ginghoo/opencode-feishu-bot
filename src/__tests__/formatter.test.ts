import { test, expect, describe } from 'bun:test';
import {
  createCard,
  createStatusCard,
  formatCodeBlock,
  formatToolOutput,
  formatThinkingBlock,
  formatError,
  truncateContent,
  formatMessageParts,
  buildStreamingCard,
} from '../feishu/formatter';

describe('Formatter', () => {
  describe('createCard', () => {
    test('creates basic card without title', () => {
      const card = createCard('Hello world');
      
      expect(card.config?.wide_screen_mode).toBe(true);
      expect(card.elements).toHaveLength(1);
      
      const firstElement = card.elements[0]!;
      expect(firstElement.tag).toBe('markdown');
      expect((firstElement as { content: string }).content).toBe('Hello world');
      expect(card.header).toBeUndefined();
    });

    test('creates card with title', () => {
      const card = createCard('Content', 'My Title');
      
      expect(card.header).toBeDefined();
      expect(card.header!.title.content).toBe('My Title');
      expect(card.header!.template).toBe('blue');
    });

    test('creates card with custom template', () => {
      const card = createCard('Content', 'Title', 'green');
      
      expect(card.header?.template).toBe('green');
    });
  });

  describe('createStatusCard', () => {
    test('creates error card with red template', () => {
      const card = createStatusCard('Error occurred');
      
      expect(card.header?.template).toBe('red');
    });

    test('creates complete card with green template', () => {
      const card = createStatusCard('Task complete');
      
      expect(card.header?.template).toBe('green');
    });

    test('creates running card with wathet template', () => {
      const card = createStatusCard('Running task');
      
      expect(card.header?.template).toBe('wathet');
    });
  });

  describe('formatCodeBlock', () => {
    test('formats code without language', () => {
      const result = formatCodeBlock('const x = 1;');
      
      expect(result).toBe('```\nconst x = 1;\n```');
    });

    test('formats code with language', () => {
      const result = formatCodeBlock('const x = 1;', 'typescript');
      
      expect(result).toBe('```typescript\nconst x = 1;\n```');
    });
  });

  describe('formatToolOutput', () => {
    test('formats tool with running status', () => {
      const result = formatToolOutput('read_file', 'running');
      
      expect(result).toContain('read_file');
      expect(result).toContain('⏳');
    });

    test('formats tool with completed status', () => {
      const result = formatToolOutput('write_file', 'completed');
      
      expect(result).toContain('✅');
    });

    test('formats tool with output', () => {
      const result = formatToolOutput('bash', 'completed', 'output text');
      
      expect(result).toContain('output text');
      expect(result).toContain('```');
    });

    test('truncates long output', () => {
      const longOutput = 'x'.repeat(3000);
      const result = formatToolOutput('bash', 'completed', longOutput);
      
      expect(result).toContain('截断');
    });
  });

  describe('formatThinkingBlock', () => {
    test('formats thinking text with blockquote', () => {
      const result = formatThinkingBlock('Let me think...');
      
      expect(result).toContain('>');
      expect(result).toContain('Let me think...');
    });

    test('truncates long thinking text', () => {
      const longText = 'x'.repeat(600);
      const result = formatThinkingBlock(longText);
      
      expect(result.length).toBeLessThan(600);
      expect(result).toContain('...');
    });

    test('handles multi-line thinking text', () => {
      const multiLine = 'Line 1\nLine 2\nLine 3';
      const result = formatThinkingBlock(multiLine);
      
      expect(result).toContain('> Line 1');
      expect(result).toContain('> Line 2');
    });
  });

  describe('formatError', () => {
    test('formats error message', () => {
      const result = formatError('Something went wrong');
      
      expect(result).toContain('❌');
      expect(result).toContain('错误');
      expect(result).toContain('Something went wrong');
    });
  });

  describe('truncateContent', () => {
    test('returns short content as-is', () => {
      const content = 'Short content';
      const result = truncateContent(content);
      
      expect(result).toBe(content);
    });

    test('truncates long content', () => {
      const longContent = 'x'.repeat(30000);
      const result = truncateContent(longContent);
      
      expect(result.length).toBeLessThan(30000);
      expect(result).toContain('截断');
    });
  });

  describe('formatMessageParts', () => {
    test('formats text parts', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
      const result = formatMessageParts(parts);
      
      expect(result).toBe('Hello');
    });

    test('formats reasoning parts with blockquote', () => {
      const parts = [{ type: 'reasoning', text: 'Thinking...' }];
      const result = formatMessageParts(parts);
      
      expect(result).toContain('> Thinking...');
    });

    test('formats tool-call parts', () => {
      const parts = [{ type: 'tool-call', name: 'read_file', state: 'running' }];
      const result = formatMessageParts(parts);
      
      expect(result).toContain('read_file');
    });

    test('formats multiple parts', () => {
      const parts = [
        { type: 'text', text: 'First' },
        { type: 'text', text: 'Second' },
      ];
      const result = formatMessageParts(parts);
      
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });
  });

  describe('buildStreamingCard', () => {
    test('builds incomplete card with wathet template', () => {
      const card = buildStreamingCard('Content', false);
      
      expect(card.header?.template).toBe('wathet');
      expect(card.header?.title.content).toBe('处理中...');
    });

    test('builds complete card with green template', () => {
      const card = buildStreamingCard('Content', true);
      
      expect(card.header?.template).toBe('green');
      expect(card.header?.title.content).toBe('响应完成');
    });

    test('uses custom title', () => {
      const card = buildStreamingCard('Content', false, 'Custom Title');
      
      expect(card.header?.title.content).toBe('Custom Title');
    });
  });
});
