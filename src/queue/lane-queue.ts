import { logger } from '../utils/logger';

export type QueueMode = 'collect' | 'steer' | 'followup';
export type OverflowStrategy = 'drop' | 'reject' | 'wait';

export interface QueuedTask<T = unknown> {
  id: string;
  sessionKey: string;
  handler: () => Promise<T>;
  mode: QueueMode;
  priority: number;
  createdAt: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export interface LaneQueueConfig {
  maxConcurrency?: number;
  maxQueueSize?: number;
  defaultMode?: QueueMode;
  overflowStrategy?: OverflowStrategy;
  taskTimeoutMs?: number;
}

interface Lane {
  queue: QueuedTask[];
  processing: boolean;
  currentTask?: QueuedTask;
}

export class LaneQueue {
  private lanes = new Map<string, Lane>();
  private globalConcurrency = 0;
  private config: Required<LaneQueueConfig>;
  private taskIdCounter = 0;

  constructor(config: LaneQueueConfig = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 10,
      maxQueueSize: config.maxQueueSize ?? 100,
      defaultMode: config.defaultMode ?? 'collect',
      overflowStrategy: config.overflowStrategy ?? 'wait',
      taskTimeoutMs: config.taskTimeoutMs ?? 300000,
    };
  }

  async enqueue<T>(
    sessionKey: string,
    handler: () => Promise<T>,
    options?: {
      mode?: QueueMode;
      priority?: number;
    }
  ): Promise<T> {
    const lane = this.getOrCreateLane(sessionKey);
    const mode = options?.mode ?? this.config.defaultMode;
    const priority = options?.priority ?? 0;

    if (lane.queue.length >= this.config.maxQueueSize) {
      switch (this.config.overflowStrategy) {
        case 'drop':
          throw new Error(`Queue overflow: task dropped for ${sessionKey}`);
        case 'reject':
          throw new Error(`Queue full for ${sessionKey}`);
        case 'wait':
          break;
      }
    }

    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        id: `task_${++this.taskIdCounter}`,
        sessionKey,
        handler,
        mode,
        priority,
        createdAt: Date.now(),
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      if (mode === 'steer' && lane.queue.length > 0) {
        lane.queue = lane.queue.filter(t => {
          if (t.mode === 'collect') {
            t.reject(new Error('Task superseded by steer mode'));
            return false;
          }
          return true;
        });
      }

      this.insertByPriority(lane.queue, task as QueuedTask);
      this.processLane(sessionKey);
    });
  }

  async abort(sessionKey: string): Promise<number> {
    const lane = this.lanes.get(sessionKey);
    if (!lane) return 0;

    const abortedCount = lane.queue.length;
    
    for (const task of lane.queue) {
      task.reject(new Error('Task aborted'));
    }
    lane.queue = [];

    return abortedCount;
  }

  getQueueLength(sessionKey: string): number {
    return this.lanes.get(sessionKey)?.queue.length ?? 0;
  }

  isProcessing(sessionKey: string): boolean {
    return this.lanes.get(sessionKey)?.processing ?? false;
  }

  getTotalQueueLength(): number {
    let total = 0;
    for (const lane of this.lanes.values()) {
      total += lane.queue.length;
    }
    return total;
  }

  getActiveCount(): number {
    return this.globalConcurrency;
  }

  clear(sessionKey?: string): void {
    if (sessionKey) {
      const lane = this.lanes.get(sessionKey);
      if (lane) {
        for (const task of lane.queue) {
          task.reject(new Error('Queue cleared'));
        }
        lane.queue = [];
      }
    } else {
      for (const lane of this.lanes.values()) {
        for (const task of lane.queue) {
          task.reject(new Error('Queue cleared'));
        }
        lane.queue = [];
      }
    }
  }

  private getOrCreateLane(sessionKey: string): Lane {
    let lane = this.lanes.get(sessionKey);
    if (!lane) {
      lane = { queue: [], processing: false };
      this.lanes.set(sessionKey, lane);
    }
    return lane;
  }

  private insertByPriority(queue: QueuedTask[], task: QueuedTask): void {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (task.priority > queue[i]!.priority) {
        queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(task);
    }
  }

  private async processLane(sessionKey: string): Promise<void> {
    const lane = this.lanes.get(sessionKey);
    if (!lane || lane.processing || lane.queue.length === 0) return;

    if (this.globalConcurrency >= this.config.maxConcurrency) {
      return;
    }

    lane.processing = true;
    this.globalConcurrency++;

    try {
      while (lane.queue.length > 0) {
        const task = lane.queue.shift()!;
        lane.currentTask = task;

        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeoutMs);
          });

          const result = await Promise.race([task.handler(), timeoutPromise]);
          task.resolve(result);
        } catch (error) {
          task.reject(error instanceof Error ? error : new Error(String(error)));
        }

        lane.currentTask = undefined;
      }
    } finally {
      lane.processing = false;
      this.globalConcurrency--;
      lane.currentTask = undefined;

      this.cleanupEmptyLane(sessionKey);
      this.tryProcessPendingLanes();
    }
  }

  private cleanupEmptyLane(sessionKey: string): void {
    const lane = this.lanes.get(sessionKey);
    if (lane && lane.queue.length === 0 && !lane.processing) {
      this.lanes.delete(sessionKey);
    }
  }

  private tryProcessPendingLanes(): void {
    if (this.globalConcurrency >= this.config.maxConcurrency) return;

    for (const [sessionKey, lane] of this.lanes) {
      if (!lane.processing && lane.queue.length > 0) {
        this.processLane(sessionKey);
        if (this.globalConcurrency >= this.config.maxConcurrency) break;
      }
    }
  }
}
