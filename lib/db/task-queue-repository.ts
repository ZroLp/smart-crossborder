import { DbClient } from './client';

export interface ClaimedTask {
  id: number;
  agent_type: string;
  input: string | null;
  user_id: number | null;
  chain: number;
  root_task_id: number | null;
  parent_task_id: number | null;
}

/**
 * DB-backed task queue on top of `task_logs`.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED`, so concurrent workers (multiple
 * processes/instances) never claim the same row: each worker's claim
 * transaction locks its own candidate row and skips rows locked by others.
 * A worker proves liveness with lease heartbeats; expired leases are
 * re-queued by `reapZombies` so a crashed worker's tasks come back to
 * pending without double execution.
 */
export class TaskQueueRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Atomically claim the oldest pending task for this worker. Runs in an
   * immediate transaction: SELECT ... FOR UPDATE SKIP LOCKED, then flip the
   * row to running with claimed_by / heartbeat_at / lease_until / started_at.
   * Returns null when no pending task is claimable.
   */
  async claimNext(workerId: string, leaseMs: number): Promise<ClaimedTask | null> {
    return this.db
      .transaction(async () => {
        const row = (await this.db
          .prepare(
            `SELECT id, agent_type, input, user_id, chain, root_task_id, parent_task_id
             FROM task_logs
             WHERE status = 'pending'
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED`
          )
          .get()) as ClaimedTask | undefined;
        if (!row) return null;

        const nowIso = new Date().toISOString();
        const leaseUntilIso = new Date(Date.now() + leaseMs).toISOString();
        await this.db
          .prepare(
            `UPDATE task_logs
             SET status = 'running',
                 claimed_by = ?,
                 heartbeat_at = ?,
                 lease_until = ?,
                 started_at = ?,
                 updated_at = ?
             WHERE id = ?`
          )
          .run(workerId, nowIso, leaseUntilIso, nowIso, nowIso, row.id);
        return row;
      })
      .immediate();
  }

  /** Extend the lease for a task this worker owns. No-op when not the owner. */
  async heartbeat(taskId: number, workerId: string, leaseMs: number): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const leaseUntilIso = new Date(Date.now() + leaseMs).toISOString();
    const result = await this.db
      .prepare(
        `UPDATE task_logs
         SET heartbeat_at = ?, lease_until = ?, updated_at = ?
         WHERE id = ? AND claimed_by = ? AND status = 'running'`
      )
      .run(nowIso, leaseUntilIso, nowIso, taskId, workerId);
    return result.changes > 0;
  }

  /**
   * Re-queue zombie running tasks whose lease has expired: back to pending,
   * claim/lease fields cleared, requeue_count incremented. Returns the
   * number of re-queued rows.
   */
  async reapZombies(leaseMs: number): Promise<number> {
    // leaseMs keeps the API symmetric with claim/heartbeat; expiration is
    // decided purely by lease_until <= now() (a claim sets lease_until to
    // now()+leaseMs and heartbeats extend it the same way).
    void leaseMs;
    const result = await this.db
      .prepare(
        `UPDATE task_logs
         SET status = 'pending',
             claimed_by = NULL,
             heartbeat_at = NULL,
             lease_until = NULL,
             started_at = NULL,
             requeue_count = requeue_count + 1,
             updated_at = now()
         WHERE status = 'running'
           AND lease_until IS NOT NULL
           AND lease_until <= now()`
      )
      .run();
    return result.changes;
  }

  /** Count a user's active (pending + running) tasks — for the concurrency cap. */
  async countActiveForUser(userId: number): Promise<number> {
    const row = (await this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM task_logs WHERE user_id = ? AND status IN ('pending', 'running')`
      )
      .get(userId)) as { count: number };
    return Number(row.count);
  }
}
