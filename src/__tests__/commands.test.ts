import { test, expect, describe } from 'bun:test';
import {
  isCommand,
  parseCommand,
  getCommand,
  getAvailableCommands,
  formatHelpMessage,
  COMMANDS,
} from '../commands/parser';

describe('Command Parser', () => {
  describe('isCommand', () => {
    test('returns true for command strings', () => {
      expect(isCommand('/help')).toBe(true);
      expect(isCommand('/switch_project /path/to/project')).toBe(true);
    });

    test('returns false for non-command strings', () => {
      expect(isCommand('hello')).toBe(false);
      expect(isCommand('  hello')).toBe(false);
    });

    test('returns true for command with leading whitespace', () => {
      expect(isCommand('  /help')).toBe(true);
    });
  });

  describe('parseCommand', () => {
    test('parses simple command', () => {
      const result = parseCommand('/help');
      
      expect(result).not.toBeNull();
      expect(result!.command).toBe('help');
      expect(result!.args).toHaveLength(0);
    });

    test('parses command with arguments', () => {
      const result = parseCommand('/switch_project /path/to/project');
      
      expect(result).not.toBeNull();
      expect(result!.command).toBe('switch_project');
      expect(result!.args).toEqual(['/path/to/project']);
      expect(result!.rawArgs).toBe('/path/to/project');
    });

    test('parses command with multiple arguments', () => {
      const result = parseCommand('/whitelist_add user1 user2');
      
      expect(result).not.toBeNull();
      expect(result!.args).toEqual(['user1', 'user2']);
    });

    test('converts command to lowercase', () => {
      const result = parseCommand('/HELP');
      
      expect(result).not.toBeNull();
      expect(result!.command).toBe('help');
    });

    test('returns null for non-command', () => {
      const result = parseCommand('hello');
      expect(result).toBeNull();
    });

    test('returns null for empty command', () => {
      const result = parseCommand('/');
      expect(result).toBeNull();
    });
  });

  describe('getCommand', () => {
    test('returns command definition', () => {
      const cmd = getCommand('help');
      
      expect(cmd).not.toBeNull();
      expect(cmd!.name).toBe('help');
      expect(cmd!.adminOnly).toBe(false);
    });

    test('returns null for unknown command', () => {
      const cmd = getCommand('unknown');
      expect(cmd).toBeNull();
    });
  });

  describe('getAvailableCommands', () => {
    test('returns all commands for admin', () => {
      const commands = getAvailableCommands(true);
      const allCommands = Object.values(COMMANDS);
      
      expect(commands.length).toBe(allCommands.length);
    });

    test('excludes admin commands for non-admin', () => {
      const commands = getAvailableCommands(false);
      const adminCommands = commands.filter(c => c.adminOnly);
      
      expect(adminCommands.length).toBe(0);
    });
  });

  describe('formatHelpMessage', () => {
    test('formats help message for non-admin', () => {
      const message = formatHelpMessage(false);
      
      expect(message).toContain('可用命令');
      expect(message).toContain('/help');
      expect(message).not.toContain('/whitelist_add');
    });

    test('formats help message for admin', () => {
      const message = formatHelpMessage(true);
      
      expect(message).toContain('/whitelist_add');
      expect(message).toContain('/whitelist_remove');
    });
  });
});
