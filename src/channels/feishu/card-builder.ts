import type { UnifiedReply, ContentBlock, ReplyStatus } from '../../types/message';

export interface FeishuCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
    update_multi?: boolean;
  };
  header?: {
    title?: { tag: string; content: string };
    template?: string;
  };
  elements: Array<{
    tag: string;
    content?: string;
    text?: { tag: string; content: string };
    [key: string]: unknown;
  }>;
}

const STATUS_TEMPLATES: Record<ReplyStatus, string> = {
  pending: 'blue',
  streaming: 'blue',
  completed: 'green',
  error: 'red',
  cancelled: 'orange',
};

export class CardBuilder {
  buildFromReply(reply: UnifiedReply): FeishuCard {
    const elements = this.buildElements(reply.blocks, reply.status);
    
    return {
      config: {
        wide_screen_mode: true,
        enable_forward: true,
        update_multi: true,
      },
      header: this.buildHeader(reply.status),
      elements,
    };
  }

  private buildHeader(status: ReplyStatus): FeishuCard['header'] {
    const titles: Record<ReplyStatus, string> = {
      pending: '处理中...',
      streaming: '生成中...',
      completed: '完成',
      error: '错误',
      cancelled: '已取消',
    };

    return {
      title: { tag: 'plain_text', content: titles[status] },
      template: STATUS_TEMPLATES[status],
    };
  }

  private buildElements(blocks: ContentBlock[], status: ReplyStatus): FeishuCard['elements'] {
    const elements: FeishuCard['elements'] = [];

    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          elements.push({
            tag: 'markdown',
            content: this.adaptMarkdownForFeishu(block.content),
          });
          break;

        case 'code':
          const lang = block.language || '';
          elements.push({
            tag: 'markdown',
            content: `\`\`\`${lang}\n${block.content}\n\`\`\``,
          });
          break;

        case 'thinking':
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `<font color='grey'>💭 ${this.truncate(block.content, 200)}</font>`,
            },
          });
          break;

        case 'tool_call':
          const statusIcon = this.getToolStatusIcon(block.status);
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `${statusIcon} **${block.toolName}**`,
            },
          });
          break;

        case 'tool_result':
          const resultIcon = block.success ? '✅' : '❌';
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `${resultIcon} ${block.toolName} ${block.success ? '成功' : '失败'}`,
            },
          });
          break;

        case 'error':
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `❌ **错误**: ${block.message}`,
            },
          });
          break;

        case 'image':
          if (block.url) {
            elements.push({
              tag: 'img',
              img_key: block.url,
              alt: { tag: 'plain_text', content: block.alt || 'Image' },
            });
          }
          break;

        case 'file':
          elements.push({
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `📎 **文件**: ${block.filename}`,
            },
          });
          break;
      }
    }

    if (elements.length === 0) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'plain_text',
          content: status === 'streaming' ? '...' : ' ',
        },
      });
    }

    return elements;
  }

  private getToolStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '🔧';
    }
  }

  /** 将标准 Markdown 转换为飞书卡片兼容格式 */
  private adaptMarkdownForFeishu(content: string): string {
    return content
      // 将 # 标题转换为粗体（飞书卡片不支持标题语法）
      .replace(/^#{1,6}\s+(.+)$/gm, '**$1**')
      // 将 HTML 标签移除（飞书不支持）
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '');
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
}
