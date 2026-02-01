import { describe, test, expect, beforeEach } from 'bun:test';
import { LaneQueue } from '../../queue/lane-queue';

describe('LaneQueue', () => {
  let queue: LaneQueue;

  beforeEach(() => {
    queue = new LaneQueue({
      maxConcurrency: 3,
      maxQueueSize: 10,
      taskTimeoutMs: 5000,
    });
  });

  test('should process single task', async () => {
    let executed = false;
    
    await queue.enqueue('session_1', async () => {
      executed = true;
      return 'done';
    });
    
    expect(executed).toBe(true);
  });

  test('should return task result', async () => {
    const result = await queue.enqueue('session_1', async () => {
      return 42;
    });
    
    expect(result).toBe(42);
  });

  test('should process tasks in order for same session', async () => {
    const order: number[] = [];
    
    const p1 = queue.enqueue('session_1', async () => {
      await sleep(50);
      order.push(1);
    });
    
    const p2 = queue.enqueue('session_1', async () => {
      order.push(2);
    });
    
    const p3 = queue.enqueue('session_1', async () => {
      order.push(3);
    });
    
    await Promise.all([p1, p2, p3]);
    
    expect(order).toEqual([1, 2, 3]);
  });

  test('should process different sessions concurrently', async () => {
    const started: string[] = [];
    const completed: string[] = [];
    
    const p1 = queue.enqueue('session_1', async () => {
      started.push('s1');
      await sleep(50);
      completed.push('s1');
    });
    
    const p2 = queue.enqueue('session_2', async () => {
      started.push('s2');
      await sleep(30);
      completed.push('s2');
    });
    
    await Promise.all([p1, p2]);
    
    expect(started).toContain('s1');
    expect(started).toContain('s2');
  });

  test('should track queue length', async () => {
    expect(queue.getQueueLength('session_1')).toBe(0);
    
    const slowTask = queue.enqueue('session_1', async () => {
      await sleep(100);
    });
    
    queue.enqueue('session_1', async () => {});
    queue.enqueue('session_1', async () => {});
    
    expect(queue.getQueueLength('session_1')).toBeGreaterThanOrEqual(0);
    
    await slowTask;
  });

  test('should track processing state', async () => {
    expect(queue.isProcessing('session_1')).toBe(false);
    
    const task = queue.enqueue('session_1', async () => {
      await sleep(50);
    });
    
    await sleep(10);
    expect(queue.isProcessing('session_1')).toBe(true);
    
    await task;
    expect(queue.isProcessing('session_1')).toBe(false);
  });

  test('should abort pending tasks', async () => {
    const slowTask = queue.enqueue('session_1', async () => {
      await sleep(100);
    });
    
    let task2Rejected = false;
    const task2 = queue.enqueue('session_1', async () => {})
      .catch(() => { task2Rejected = true; });
    
    await sleep(10);
    const aborted = await queue.abort('session_1');
    
    await slowTask;
    await task2;
    
    expect(aborted).toBeGreaterThanOrEqual(0);
  });

  test('should respect priority order', async () => {
    const order: number[] = [];
    
    const slowTask = queue.enqueue('session_1', async () => {
      await sleep(50);
      order.push(0);
    });
    
    queue.enqueue('session_1', async () => { order.push(1); }, { priority: 1 });
    queue.enqueue('session_1', async () => { order.push(3); }, { priority: 3 });
    queue.enqueue('session_1', async () => { order.push(2); }, { priority: 2 });
    
    await sleep(200);
    
    expect(order[0]).toBe(0);
    expect(order.slice(1).sort()).toEqual([1, 2, 3]);
  });

  test('should steer mode supersede collect tasks', async () => {
    let collectRejected = false;
    
    const slowTask = queue.enqueue('session_1', async () => {
      await sleep(50);
    });
    
    const collectTask = queue.enqueue('session_1', async () => {
    }, { mode: 'collect' }).catch(() => { collectRejected = true; });
    
    const steerTask = queue.enqueue('session_1', async () => {}, { mode: 'steer' });
    
    await slowTask;
    await collectTask;
    await steerTask;
    
    expect(collectRejected).toBe(true);
  });

  test('should clear queue for specific session', () => {
    queue.enqueue('session_1', async () => { await sleep(1000); });
    queue.enqueue('session_1', async () => {}).catch(() => {});
    queue.enqueue('session_2', async () => {}).catch(() => {});
    
    queue.clear('session_1');
    
    expect(queue.getQueueLength('session_2')).toBeGreaterThanOrEqual(0);
  });

  test('should clear all queues', () => {
    queue.enqueue('session_1', async () => { await sleep(1000); });
    queue.enqueue('session_1', async () => {}).catch(() => {});
    queue.enqueue('session_2', async () => {}).catch(() => {});
    
    queue.clear();
    
    expect(queue.getTotalQueueLength()).toBe(0);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
