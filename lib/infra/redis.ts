import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;
let initStarted = false;

/**
 * 可选 Redis 客户端：配置 REDIS_URL 才连接，否则返回 null。
 * 多实例部署下登录限流与任务取消广播依赖它；单实例可完全不配置。
 */
export function getRedis(): Redis | null {
  if (initStarted) return redisInstance;
  initStarted = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redisInstance = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
    redisInstance.on('error', (error) => {
      console.error('[redis] connection error:', error.message);
    });
    return redisInstance;
  } catch (error) {
    console.error('[redis] init failed, falling back to in-process state:', error);
    return null;
  }
}

export function hasRedis(): boolean {
  return getRedis() !== null;
}
