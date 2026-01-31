import { test, expect, describe } from 'bun:test';
import { extractTextFromPart, extractToolCallFromPart } from '../opencode/client';

describe('OpenCode Client', () => {
  describe('extractTextFromPart', () => {
    test('extracts text from text part', () => {
      const part = { type: 'text', text: 'Hello world' };
      const text = extractTextFromPart(part);
      expect(text).toBe('Hello world');
    });

    test('extracts text from reasoning part with prefix', () => {
      const part = { type: 'reasoning', text: 'Let me think...' };
      const text = extractTextFromPart(part);
      expect(text).toBe('[思考中] Let me think...');
    });

    test('returns null for unknown part type', () => {
      const part = { type: 'unknown', text: 'test' };
      const text = extractTextFromPart(part);
      expect(text).toBeNull();
    });

    test('returns null for null input', () => {
      const text = extractTextFromPart(null);
      expect(text).toBeNull();
    });

    test('returns null for non-object input', () => {
      const text = extractTextFromPart('string');
      expect(text).toBeNull();
    });
  });

  describe('extractToolCallFromPart', () => {
    test('extracts tool call info', () => {
      const part = { type: 'tool', tool: 'read_file', state: { status: 'running' } };
      const toolCall = extractToolCallFromPart(part);
      
      expect(toolCall).not.toBeNull();
      expect(toolCall!.name).toBe('read_file');
      expect(toolCall!.state).toBe('running');
    });

    test('uses default state when not provided', () => {
      const part = { type: 'tool', tool: 'write_file' };
      const toolCall = extractToolCallFromPart(part);
      
      expect(toolCall).not.toBeNull();
      expect(toolCall!.state).toBe('pending');
    });

    test('extracts full tool info including input, output, title', () => {
      const part = {
        type: 'tool',
        tool: 'read',
        state: {
          status: 'completed',
          title: 'Reading file: /path/to/file.ts',
          input: { filePath: '/path/to/file.ts', limit: 100 },
          output: 'file contents here',
        },
      };
      const toolCall = extractToolCallFromPart(part);
      
      expect(toolCall).not.toBeNull();
      expect(toolCall!.name).toBe('read');
      expect(toolCall!.state).toBe('completed');
      expect(toolCall!.title).toBe('Reading file: /path/to/file.ts');
      expect(toolCall!.input).toEqual({ filePath: '/path/to/file.ts', limit: 100 });
      expect(toolCall!.output).toBe('file contents here');
    });

    test('extracts error from tool state', () => {
      const part = {
        type: 'tool',
        tool: 'bash',
        state: {
          status: 'error',
          input: { command: 'invalid-command' },
          error: 'Command not found',
        },
      };
      const toolCall = extractToolCallFromPart(part);
      
      expect(toolCall).not.toBeNull();
      expect(toolCall!.state).toBe('error');
      expect(toolCall!.error).toBe('Command not found');
    });

    test('returns null for non-tool part', () => {
      const part = { type: 'text', text: 'hello' };
      const toolCall = extractToolCallFromPart(part);
      expect(toolCall).toBeNull();
    });

    test('returns null for null input', () => {
      const toolCall = extractToolCallFromPart(null);
      expect(toolCall).toBeNull();
    });
  });
});
