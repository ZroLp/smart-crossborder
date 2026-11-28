const PLACEHOLDER = /your-.*-here|change-me|<your/i;

/** 生产环境必须提供（且不得为占位符）的密钥清单。 */
const REQUIRED_IN_PRODUCTION: Array<{ key: string; purpose: string }> = [
  { key: 'DATABASE_URL', purpose: 'Postgres 连接串' },
  { key: 'PAYMENT_WEBHOOK_SECRET', purpose: '支付 Webhook HMAC 签名' },
  { key: 'OPENAI_API_KEY', purpose: 'AI 运行时' },
  { key: 'MAINTENANCE_SECRET', purpose: '会话维护接口鉴权' },
];

/**
 * P10-03 密钥 fail fast：生产启动时校验必备密钥，缺失或占位值直接拒绝启动。
 * 返回缺失项描述（空数组 = 全部通过）；抛出 Error 表示启动被阻断。
 */
export function listMissingSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  const missing: string[] = [];
  for (const { key, purpose } of REQUIRED_IN_PRODUCTION) {
    const value = env[key];
    if (!value || PLACEHOLDER.test(value)) missing.push(`${key}（${purpose}）`);
  }
  return missing;
}

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  // 仅生产生效；SECRET_FAIL_FAST=false 可显式降级为警告（供过渡期使用）。
  if (env.NODE_ENV !== 'production' || env.SECRET_FAIL_FAST === 'false') return;

  const missing = listMissingSecrets(env);
  if (missing.length > 0) {
    throw new Error(`[secrets] production startup blocked, missing/placeholder: ${missing.join(', ')}`);
  }
}
