import { getDb } from '@/lib/db/init'
import type { DbClient } from '@/lib/db/client'

/**
 * P5-02 analytics events —— 产品埋点与归因。
 *
 * 四个规范事件（白名单，其余一律 400）：
 *   signup          注册/登录成功（客户端上报，携带渠道归因 source）
 *   shop_connected  店铺绑定成功（服务端在 /api/shop POST 成功后落库）
 *   task_submitted  Agent 任务提交（服务端在任务创建时落库）
 *   task_completed  Agent 任务成功完成（服务端在任务终态落库）
 *
 * 归因：`source` 为渠道来源（UTM source / 推荐人等），NULL 时按 'direct' 归组。
 */
export const ANALYTICS_EVENTS = [
  'signup',
  'shop_connected',
  'task_submitted',
  'task_completed',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

export interface TrackEventOptions {
  /** 事件属性（对象，JSON 序列化后 ≤4KB） */
  properties?: Record<string, unknown>
  /** 渠道归因来源，如 'utm:blog'、'partner:x'；缺省为 direct */
  source?: string | null
  /** 会话 ID（客户端生成，用于漏斗内去重） */
  sessionId?: string | null
}

export interface AnalyticsSummary {
  totals: Record<AnalyticsEventName, number>
  /** 按归因来源分组（'direct' 表示未携带来源）。 */
  sources: Array<{ source: string; count: number }>
  /** 漏斗：signup → shop_connected → task_submitted → task_completed（事件计数口径）。 */
  funnel: Record<AnalyticsEventName, number>
}

export class AnalyticsRepository {
  constructor(private db: DbClient) {}

  static of(db?: DbClient): AnalyticsRepository {
    return new AnalyticsRepository(db ?? getDb())
  }

  /** Static convenience so call sites can use `AnalyticsRepository.trackSafe(...)` without resolving the DB. */
  static track(userId: number, eventName: AnalyticsEventName, options: TrackEventOptions = {}): Promise<void> {
    return AnalyticsRepository.of().track(userId, eventName, options)
  }

  static trackSafe(userId: number, eventName: AnalyticsEventName, options: TrackEventOptions = {}): Promise<void> {
    return AnalyticsRepository.of().trackSafe(userId, eventName, options)
  }

  async track(userId: number, eventName: AnalyticsEventName, options: TrackEventOptions = {}): Promise<void> {
    const propertiesJson =
      options.properties && Object.keys(options.properties).length > 0
        ? JSON.stringify(options.properties).slice(0, 4096)
        : null
    await this.db
      .prepare(
        `INSERT INTO analytics_events (user_id, event_name, properties_json, source, session_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        eventName,
        propertiesJson,
        options.source ?? null,
        options.sessionId ?? null
      )
  }

  /** 失败不得影响主流程的埋点入口（fire-and-forget 语义，但返回 Promise 供测试 await）。 */
  trackSafe(userId: number, eventName: AnalyticsEventName, options: TrackEventOptions = {}): Promise<void> {
    return this.track(userId, eventName, options).catch(() => undefined)
  }

  async summary(userId: number): Promise<AnalyticsSummary> {
    const rows = (await this.db
      .prepare(
        `SELECT event_name,
                COALESCE(source, 'direct') AS src,
                COUNT(*) AS n
         FROM analytics_events
         WHERE user_id = ?
         GROUP BY event_name, src`
      )
      .all(userId)) as Array<{ event_name: string; src: string; n: number }>

    const totals = {} as Record<AnalyticsEventName, number>
    for (const event of ANALYTICS_EVENTS) totals[event] = 0
    const sourceMap = new Map<string, number>()

    for (const row of rows) {
      if (ANALYTICS_EVENTS.includes(row.event_name as AnalyticsEventName)) {
        totals[row.event_name as AnalyticsEventName] += Number(row.n)
      }
      sourceMap.set(row.src, (sourceMap.get(row.src) ?? 0) + Number(row.n))
    }

    const sources = [...sourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))

    return {
      totals,
      sources,
      // 漏斗按事件计数（同一用户视角，signup 至多 1 次为注册口径）。
      funnel: {
        signup: totals.signup,
        shop_connected: totals.shop_connected,
        task_submitted: totals.task_submitted,
        task_completed: totals.task_completed,
      },
    }
  }
}
