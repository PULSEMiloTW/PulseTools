import type { MessageEvent } from '../../shared/src/audit.js';

export class EventRouter<T extends { guildId: string; eventKey: string } = MessageEvent> {
  private readonly queues = new Map<string, Promise<void>>();
  private pending = 0;
  private stopped = false;
  constructor(private readonly consume: (event: T) => Promise<unknown>, private readonly onError: (code: string) => void, private readonly capacity = 1000) {}
  dispatch(event: T): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.pending >= this.capacity) { this.onError('AUDIT_QUEUE_FULL'); return Promise.resolve(); }
    this.pending++;
    const key = event.guildId;
    const operation = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await this.consume(event); return; }
        catch (error) {
          const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
          const failure = cause && typeof cause === 'object' ? cause : error;
          const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
          if (attempt === 2 || !['40001', '40P01', '08006', 'ECONNRESET'].includes(code)) { this.onError('AUDIT_WRITE_FAILED'); return; }
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }).finally(() => { this.pending--; if (this.queues.get(key) === operation) this.queues.delete(key); });
    this.queues.set(key, operation);
    return operation;
  }
  async shutdown() { this.stopped = true; await Promise.all(this.queues.values()); }
}
