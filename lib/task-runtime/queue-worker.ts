import { getDb } from '@/lib/db/init';
import { TaskQueueRepository, ClaimedTask } from '@/lib/db/task-queue-repository';
import { executeTaskById } from '@/lib/agents/task-service';

export interface TaskQueueWorkerOptions {
  /** Worker instance id written to task_logs.claimed_by. */
  workerId?: string;
  /** Poll interval in ms. */
  pollMs?: number;
  /** Lease length in ms granted on claim / extended on heartbeat. */
  leaseMs?: number;
  /** Heartbeat interval for tasks this worker is running. */
  heartbeatMs?: number;
  /** Zombie-reaper interval. */
  reaperMs?: number;
  /** How many tasks to claim + run per poll (in-flight cap). */
  maxPerCycle?: number;
}

/**
 * In-process DB-queue worker. Multiple instances can run it; the
 * `FOR UPDATE SKIP LOCKED` claim in the repository arbitrates so no task is
 * ever executed twice. Heartbeats keep the lease alive; the reaper puts
 * tasks of crashed/abandoned workers back into the pending pool.
 */
export class TaskQueueWorker {
  private readonly workerId: string;
  private readonly pollMs: number;
  private readonly leaseMs: number;
  private readonly heartbeatMs: number;
  private readonly reaperMs: number;
  private readonly maxPerCycle: number;

  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reaperTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inFlight = new Set<number>();

  constructor(options: Partial<TaskQueueWorkerOptions> = {}) {
    this.workerId = options.workerId ?? `${process.env.HOSTNAME || 'local'}-${process.pid}`;
    this.pollMs = options.pollMs ?? 500;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.heartbeatMs = options.heartbeatMs ?? 15_000;
    this.reaperMs = options.reaperMs ?? 30_000;
    this.maxPerCycle = options.maxPerCycle ?? 5;
  }

  private queue(): TaskQueueRepository {
    return new TaskQueueRepository(getDb());
  }

  /**
   * Claim one task and execute it. Resolves after the task finishes
   * (completed/failed/terminated are all "finished"); returns the claimed
   * task id, or null when the queue is empty.
   */
  async claimAndRunOnce(): Promise<number | null> {
    const claimed = await this.queue().claimNext(this.workerId, this.leaseMs);
    if (!claimed) return null;
    this.inFlight.add(claimed.id);
    try {
      await this.executeClaimed(claimed);
    } finally {
      this.inFlight.delete(claimed.id);
    }
    return claimed.id;
  }

  /** Start the poll + heartbeat + reaper loops. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollTimer = setInterval(() => {
      void this.pollCycle();
    }, this.pollMs);
    this.reaperTimer = setInterval(() => {
      void this.reapCycle();
    }, this.reaperMs);
    void this.pollCycle();
  }

  /** Stop all loops and clear timers. */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
  }

  /** Claim up to the free in-flight slots and run them concurrently. */
  private async pollCycle(): Promise<void> {
    if (!this.running) return;
    let slots = this.maxPerCycle - this.inFlight.size;
    while (slots > 0 && this.running) {
      const claimed = await this.queue().claimNext(this.workerId, this.leaseMs);
      if (!claimed) return;
      this.inFlight.add(claimed.id);
      this.executeClaimed(claimed).finally(() => {
        this.inFlight.delete(claimed.id);
      });
      slots -= 1;
    }
  }

  private async reapCycle(): Promise<void> {
    if (!this.running) return;
    try {
      await this.queue().reapZombies(this.leaseMs);
    } catch (error) {
      console.error(`[task-queue] worker ${this.workerId} reap failed:`, error);
    }
  }

  /** Run a claimed task, refreshing its lease until it finishes. */
  private async executeClaimed(claimed: ClaimedTask): Promise<void> {
    const heartbeat = setInterval(() => {
      this.queue()
        .heartbeat(claimed.id, this.workerId, this.leaseMs)
        .catch(() => undefined);
    }, this.heartbeatMs);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();
    try {
      await executeTaskById(claimed.id, claimed.chain !== 0);
    } catch (error) {
      // Execution errors are persisted by executeTaskById itself; this only
      // covers infra failures — the reaper will return the task to the pool.
      console.error(`[task-queue] worker ${this.workerId} task ${claimed.id} crashed:`, error);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
