import { DbClient } from './client';

/** Quota view for a single user. `aiCallsLimit === null` means "no limit set". */
export interface QuotaInfo {
  plan: string | null;
  aiCallsLimit: number | null;
  aiCallsUsed: number;
}

/** Result of a quota gate check. `allowed === false` maps to HTTP 402. */
export interface QuotaCheck {
  allowed: boolean;
  limit: number | null;
  used: number;
}

/** Per-user usage row for the admin endpoint. */
export interface UserUsageRow {
  userId: number;
  plan: string | null;
  aiCallsLimit: number | null;
  aiCallsUsed: number;
}

/** Aggregated usage payload for the admin endpoint. */
export interface QuotaUsageSummary {
  users: UserUsageRow[];
  totals: {
    userCount: number;
    totalUsed: number;
    unlimited: number;
    limited: number;
  };
}

/**
 * Reads subscription/quota state off the `users` table and AI task usage off
 * `task_logs`. A null `subscription_ai_calls` (or -1) means "unlimited" — new
 * users created without subscription columns are therefore always allowed.
 */
export class QuotaRepository {
  constructor(private readonly db: DbClient) {}

  async getQuota(userId: number): Promise<QuotaInfo> {
    const userRow = (await this.db
      .prepare('SELECT subscription_plan, subscription_ai_calls FROM users WHERE id = ?')
      .get(userId)) as
      | { subscription_plan: string | null; subscription_ai_calls: number | null }
      | undefined;

    const plan = userRow?.subscription_plan ?? null;
    const aiCallsLimit = userRow?.subscription_ai_calls ?? null;
    const aiCallsUsed = await this.countAiCallsUsed(userId);

    return { plan, aiCallsLimit, aiCallsUsed };
  }

  /**
   * Quota gate: `allowed` is true when the limit is unset (null), enterprise
   * unlimited (-1), or the used count is still below the limit. The 402
   * condition is `allowed === false`.
   */
  async checkQuota(userId: number): Promise<QuotaCheck> {
    const { aiCallsLimit, aiCallsUsed } = await this.getQuota(userId);
    const limit = aiCallsLimit;
    const used = aiCallsUsed;
    const allowed = limit === null || limit === -1 || used < limit;
    return { allowed, limit, used };
  }

  /** Per-user usage + totals for the admin endpoint. */
  async usageSummary(): Promise<QuotaUsageSummary> {
    const rows = (await this.db
      .prepare(
        `SELECT u.id,
                u.subscription_plan,
                u.subscription_ai_calls,
                (SELECT COUNT(*) FROM task_logs t
                  WHERE t.user_id = u.id
                    AND t.status IN ('completed','failed','running','pending')) AS ai_calls_used
         FROM users u
         ORDER BY u.id`
      )
      .all()) as Array<{
      id: number;
      subscription_plan: string | null;
      subscription_ai_calls: number | null;
      ai_calls_used: number;
    }>;

    const users: UserUsageRow[] = rows.map((row) => ({
      userId: Number(row.id),
      plan: row.subscription_plan ?? null,
      aiCallsLimit: row.subscription_ai_calls ?? null,
      aiCallsUsed: Number(row.ai_calls_used),
    }));

    const totals = {
      userCount: users.length,
      totalUsed: users.reduce((sum, row) => sum + row.aiCallsUsed, 0),
      unlimited: users.filter((row) => row.aiCallsLimit === null || row.aiCallsLimit === -1).length,
      limited: users.filter((row) => row.aiCallsLimit !== null && row.aiCallsLimit !== -1).length,
    };

    return { users, totals };
  }

  /** Count of a user's AI task usage across active + terminal statuses. */
  private async countAiCallsUsed(userId: number): Promise<number> {
    const row = (await this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM task_logs WHERE user_id = ? AND status IN ('completed','failed','running','pending')"
      )
      .get(userId)) as { count: number };
    return Number(row.count);
  }
}
