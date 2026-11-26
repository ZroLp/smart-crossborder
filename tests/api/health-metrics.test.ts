import type { DbClient } from '@/lib/db/client'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat, installPgliteWorkerGuard } from '../helpers/db-compat'
import { GET as healthGET } from '@/app/api/health/route'
import { GET as metricsGET } from '@/app/api/monitor/metrics/route'

// P10-02 可观测端点
installPgliteWorkerGuard()

let db: DbClient

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
  await seedTaskLogs()
})

afterEach(async () => {
  await db.close()
})

async function seedTaskLogs() {
  await db
    .prepare(`INSERT INTO task_logs (agent_type, task_name, status, user_id)
              VALUES ('content', 't1', 'pending', NULL), ('content', 't2', 'running', NULL)`)
    .run()
}

describe('GET /api/health', () => {
  test('db 就绪 → 200 ok；redis 未配置标记 disabled', async () => {
    const res = await healthGET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; status: string; checks: { db: string; redis: string } }
    expect(body.success).toBe(true)
    expect(body.status).toBe('ok')
    expect(body.checks.db).toBe('ok')
    expect(['ok', 'disabled', 'fail']).toContain(body.checks.redis)
  })
})

describe('GET /api/monitor/metrics', () => {
  test('Prometheus 文本格式，含队列深度（分状态）与 worker 活性指标', async () => {
    const res = await metricsGET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')!).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('process_uptime_seconds')
    expect(text).toContain('app_task_queue_depth{status="pending"} 1')
    expect(text).toContain('app_task_queue_depth{status="running"} 1')
    expect(text).toContain('app_tasks_zombie_candidates')
    expect(text).toContain('app_last_task_completed_ago_seconds')
  })
})
