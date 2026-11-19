import { getRedis } from './redis';

export const TASK_CANCEL_TOPIC = 'sumaitong:task:cancel';

/**
 * 广播任务取消意图（pause/terminate）。
 * 单实例部署下 Redis 未配置时为 no-op——本地 abortController 已生效；
 * 多实例部署下其它实例订阅该频道并中止本地执行中的任务。
 */
export function publishTaskCancel(taskId: number, action: 'pause' | 'terminate'): void {
  const redis = getRedis();
  if (!redis) return;
  redis.publish(TASK_CANCEL_TOPIC, JSON.stringify({ taskId, action, at: Date.now() })).catch(() => {
    // 广播失败只影响跨实例取消及时性，本地取消不受影响。
  });
}

/** 订阅取消广播；返回的 cleanup 解除订阅。Redis 未配置时返回 no-op。 */
export function subscribeTaskCancel(handler: (message: { taskId: number; action: 'pause' | 'terminate' }) => void): () => void {
  const redis = getRedis();
  if (!redis) return () => undefined;

  let subscription = redis.duplicate();
  subscription.connect().catch(() => undefined);
  subscription.on('error', () => undefined);
  subscription.subscribe(TASK_CANCEL_TOPIC, (error) => {
    if (error) console.error('[redis] task cancel subscribe failed:', error.message);
  });
  subscription.on('message', (_channel: string, payload: string) => {
    try {
      handler(JSON.parse(payload));
    } catch {
      /* 非 JSON 载荷忽略 */
    }
  });

  return () => {
    subscription.unsubscribe(TASK_CANCEL_TOPIC).catch(() => undefined);
    subscription.disconnect();
  };
}
