import { TaskQueueWorker } from './queue-worker';

/**
 * P2/P10 每实例单例 worker 注册表：多实例部署时由 instrumentation 钩子在
 * 生产启动阶段自动拉起（SKIP LOCKED 仲裁保证任务不重复执行）；
 * 单实例开发/测试可完全不调用。
 */
let instance: TaskQueueWorker | null = null;

export function startQueueWorker(): TaskQueueWorker {
  if (instance) return instance;
  instance = new TaskQueueWorker();
  instance.start();
  return instance;
}

export function stopQueueWorker(): void {
  if (instance) {
    instance.stop();
    instance = null;
  }
}

export function isQueueWorkerRunning(): boolean {
  return instance !== null;
}
