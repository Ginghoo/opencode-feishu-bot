export interface MockOpencodeSession {
  id: string;
  projectPath: string;
  createdAt: Date;
}

export interface MockOpencodeEvent {
  type: 'message.start' | 'message.delta' | 'message.complete' | 'tool.start' | 'tool.complete' | 'error';
  data: unknown;
}

export type EventHandler = (event: MockOpencodeEvent) => void;

export class MockOpencodeClient {
  private sessions: Map<string, MockOpencodeSession> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private sessionCounter = 0;

  async createSession(projectPath: string): Promise<MockOpencodeSession> {
    this.sessionCounter++;
    const session: MockOpencodeSession = {
      id: `session_${this.sessionCounter}`,
      projectPath,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.eventHandlers.set(session.id, []);
    return session;
  }

  async getSession(sessionId: string): Promise<MockOpencodeSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const handlers = this.eventHandlers.get(sessionId);
    if (!handlers) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    this.emitEvent(sessionId, { type: 'message.start', data: {} });
    
    const words = message.split(' ');
    for (const word of words) {
      this.emitEvent(sessionId, {
        type: 'message.delta',
        data: { content: word + ' ' },
      });
    }
    
    this.emitEvent(sessionId, {
      type: 'message.complete',
      data: { content: `Response to: ${message}` },
    });
  }

  subscribe(sessionId: string, handler: EventHandler): () => void {
    const handlers = this.eventHandlers.get(sessionId);
    if (!handlers) {
      throw new Error(`Session ${sessionId} not found`);
    }
    handlers.push(handler);
    
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  private emitEvent(sessionId: string, event: MockOpencodeEvent): void {
    const handlers = this.eventHandlers.get(sessionId);
    if (handlers) {
      handlers.forEach(h => h(event));
    }
  }

  reset(): void {
    this.sessions.clear();
    this.eventHandlers.clear();
    this.sessionCounter = 0;
  }
}

export function createMockOpencodeClient(): MockOpencodeClient {
  return new MockOpencodeClient();
}
