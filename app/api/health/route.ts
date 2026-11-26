import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { getRedis } from '@/lib/infra/redis';
import { isQueueWorkerRunning } from '@/lib/task-runtime/worker-registry';

export const dynamic = 'force-dynamic';

/**
 * P10-02 存活/就绪探针（容器 HEALTHCHECK、反代健康检查、监控脚本 1min 轮询共用）：
 * - db 就绪检查失败 → 503（not ready）
 * - redis 未配置视为可选（单实例降级），不阻塞就绪；配置了但 ping 失败 → degraded
 */
export async function GET() {
  const checks: { db: string; redis: string } = { db: 'ok', redis: 'ok' };
  let degraded = false;

  try {
    await getDb().execDirect('SELECT 1');
  } catch {
    checks.db = 'fail';
    return NextResponse.json(
      { success: false, status: 'unavailable', checks, uptimeSec: process.uptime() },
      { status: 503 }
    );
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
    } catch {
      checks.redis = 'fail';
      degraded = true;
    }
  } else {
    checks.redis = 'disabled';
  }

  return NextResponse.json({
    success: true,
    status: degraded ? 'degraded' : 'ok',
    checks,
    workerRunning: isQueueWorkerRunning(),
    uptimeSec: Math.round(process.uptime()),
  });
}
