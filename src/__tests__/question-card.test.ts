import { describe, test, expect } from 'bun:test';
import { createQuestionCard, createAnsweredCard, createQuestionErrorCard, type QuestionRequest } from '../feishu/question-card';

describe('createQuestionCard', () => {
  test('renders buttons for ≤3 options (single select)', () => {
    const request: QuestionRequest = {
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
    
    const json = JSON.stringify(card);
    expect(json).toContain('"tag":"button"');
    expect(json).toContain('OAuth');
    expect(json).toContain('JWT');
    expect(json).not.toContain('"tag":"select_static"');
  });

  test('renders dropdown for >3 options (single select)', () => {
    const request: QuestionRequest = {
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
    expect(json).not.toContain('"tag":"button"');
  });

  test('renders dropdown for multiple select even with ≤3 options', () => {
    const request: QuestionRequest = {
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
    expect(json).toContain('可多选');
  });

  test('includes custom answer hint', () => {
    const request: QuestionRequest = {
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

  test('uses orange header', () => {
    const request: QuestionRequest = {
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
    expect(json).toContain('"template":"orange"');
  });

  test('includes requestId and questionIndex in action value', () => {
    const request: QuestionRequest = {
      id: 'req-123',
      sessionID: 'ses-1',
      questions: [{
        question: '问题',
        header: '标题',
        options: [{ label: 'A', description: '' }],
      }],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).toContain('"requestId":"req-123"');
    expect(json).toContain('"questionIndex":0');
    expect(json).toContain('"action":"question_answer"');
  });

  test('shows option descriptions when provided', () => {
    const request: QuestionRequest = {
      id: 'req-1',
      sessionID: 'ses-1',
      questions: [{
        question: '选择？',
        header: '选择',
        options: [
          { label: 'A', description: '选项A的描述' },
          { label: 'B', description: '选项B的描述' },
        ],
      }],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).toContain('选项A的描述');
    expect(json).toContain('选项B的描述');
  });
});

describe('createAnsweredCard', () => {
  test('shows answered state with green header', () => {
    const card = createAnsweredCard('选择认证方式？', 'OAuth');
    const json = JSON.stringify(card);
    expect(json).toContain('已回答');
    expect(json).toContain('"template":"green"');
    expect(json).toContain('OAuth');
    expect(json).toContain('选择认证方式？');
  });
});

describe('createQuestionErrorCard', () => {
  test('shows error with red header', () => {
    const card = createQuestionErrorCard('问题已过期');
    const json = JSON.stringify(card);
    expect(json).toContain('操作失败');
    expect(json).toContain('"template":"red"');
    expect(json).toContain('问题已过期');
  });
});

describe('edge cases', () => {
  test('empty options shows only text prompt (custom answer only)', () => {
    const request: QuestionRequest = {
      id: 'req-1',
      sessionID: 'ses-1',
      questions: [{
        question: '请输入您的想法',
        header: '自由输入',
        options: [],
        custom: true,
      }],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).not.toContain('"tag":"button"');
    expect(json).not.toContain('"tag":"select_static"');
    expect(json).toContain('直接发送消息');
    expect(json).toContain('请输入您的想法');
  });

  test('handles multiple questions in one card', () => {
    const request: QuestionRequest = {
      id: 'req-1',
      sessionID: 'ses-1',
      questions: [
        {
          question: '问题1',
          header: '第一个',
          options: [{ label: 'A', description: '' }],
        },
        {
          question: '问题2',
          header: '第二个',
          options: [{ label: 'X', description: '' }, { label: 'Y', description: '' }],
        },
      ],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).toContain('问题1');
    expect(json).toContain('问题2');
    expect(json).toContain('"tag":"hr"');
  });

  test('exactly 3 options uses buttons', () => {
    const request: QuestionRequest = {
      id: 'req-1',
      sessionID: 'ses-1',
      questions: [{
        question: '选择？',
        header: '选择',
        options: [
          { label: 'A', description: '' },
          { label: 'B', description: '' },
          { label: 'C', description: '' },
        ],
        multiple: false,
      }],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).toContain('"tag":"button"');
    expect(json).not.toContain('"tag":"select_static"');
  });

  test('exactly 4 options uses dropdown', () => {
    const request: QuestionRequest = {
      id: 'req-1',
      sessionID: 'ses-1',
      questions: [{
        question: '选择？',
        header: '选择',
        options: [
          { label: 'A', description: '' },
          { label: 'B', description: '' },
          { label: 'C', description: '' },
          { label: 'D', description: '' },
        ],
        multiple: false,
      }],
    };
    const card = createQuestionCard(request);
    
    const json = JSON.stringify(card);
    expect(json).toContain('"tag":"select_static"');
    expect(json).not.toContain('"tag":"button"');
  });
});
