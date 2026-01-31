export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfo {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
}

const HEADER_COLORS = {
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  red: 'red',
} as const;

function createHeader(title: string, color: keyof typeof HEADER_COLORS = 'blue') {
  return {
    template: color,
    title: { tag: 'plain_text', content: title },
  };
}

function createMarkdown(content: string) {
  return {
    tag: 'markdown',
    content,
  };
}

function createDivider() {
  return { tag: 'hr' };
}

export function createQuestionCard(request: QuestionRequest): object {
  const elements: object[] = [];
  const firstQuestion = request.questions[0];
  const headerTitle = firstQuestion?.header || '🤔 请选择';

  request.questions.forEach((q, questionIndex) => {
    if (questionIndex > 0) {
      elements.push(createDivider());
    }

    elements.push(createMarkdown(`**${q.question}**`));

    if (q.options && q.options.length > 0) {
      const descriptions = q.options
        .filter(opt => opt.description)
        .map(opt => `• **${opt.label}**: ${opt.description}`)
        .join('\n');
      
      if (descriptions) {
        elements.push(createMarkdown(descriptions));
      }

      const useDropdown = q.multiple === true || q.options.length > 3;

      if (useDropdown) {
        const options = q.options.map((opt) => ({
          text: { tag: 'plain_text', content: opt.label },
          value: opt.label,
        }));

        elements.push({
          tag: 'action',
          actions: [
            {
              tag: 'select_static',
              placeholder: { tag: 'plain_text', content: q.multiple ? '选择答案（可多选）' : '选择答案' },
              value: {
                action: 'question_answer',
                requestId: request.id,
                questionIndex,
              },
              options,
            },
          ],
        });
      } else {
        const buttons = q.options.map((opt) => ({
          tag: 'button',
          text: { tag: 'plain_text', content: opt.label },
          type: 'default',
          value: {
            action: 'question_answer',
            requestId: request.id,
            questionIndex,
            answerLabel: opt.label,
          },
        }));

        elements.push({
          tag: 'action',
          actions: buttons,
        });
      }
    }
  });

  elements.push(createDivider());
  elements.push(createMarkdown('💬 或直接发送消息输入自定义答案'));

  return {
    config: { wide_screen_mode: true },
    header: createHeader(headerTitle, 'orange'),
    elements,
  };
}

export function createAnsweredCard(question: string, answer: string): object {
  return {
    config: { wide_screen_mode: true },
    header: createHeader('✅ 已回答', 'green'),
    elements: [
      createMarkdown(`**问题**: ${question}`),
      createMarkdown(`**答案**: ${answer}`),
    ],
  };
}

export function createQuestionErrorCard(message: string): object {
  return {
    config: { wide_screen_mode: true },
    header: createHeader('❌ 操作失败', 'red'),
    elements: [
      createMarkdown(message),
    ],
  };
}
