/**
 * Next instrumentation 钩子（P10）：生产启动时执行服务器侧一次性初始化。
 *
 * 1. P10-03 密钥 fail fast：NODE_ENV=production 且 SECRET_FAIL_FAST !== 'false' 时，
 *    缺失/占位密钥直接抛错使进程启动失败（拒绝带病上线）；
 * 2. P2/P10 多实例自动 worker：每实例自动拉起 TaskQueueWorker（SKIP LOCKED 仲裁，
 *    任务绝不重复执行），WORKER_AUTO_START=false 可关闭（如仅跑 API 不跑任务）。
 */
export async function register() {
  if (process.env.JEST_WORKER_ID) return; // 测试沙箱不跑生产钩子

  if (process.env.NODE_ENV === 'production') {
    const { assertProductionSecrets } = await import('./lib/config/secrets');
    assertProductionSecrets();

    if (process.env.WORKER_AUTO_START !== 'false') {
      const { startQueueWorker } = await import('./lib/task-runtime/worker-registry');
      startQueueWorker();
      console.log('[worker] task queue worker auto-started (instance:', process.pid, ')');
    }
  }
}

export async function nuke() {
  if (process.env.NODE_ENV !== 'production') return;
  const { stopQueueWorker } = await import('./lib/task-runtime/worker-registry');
  stopQueueWorker();
}
