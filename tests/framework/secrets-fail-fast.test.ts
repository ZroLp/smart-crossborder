import { assertProductionSecrets, listMissingSecrets } from '@/lib/config/secrets'

// P10-03 密钥 fail fast
describe('assertProductionSecrets', () => {
  const validProd: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    PAYMENT_WEBHOOK_SECRET: 's3cret',
    OPENAI_API_KEY: 'sk-live',
    MAINTENANCE_SECRET: 'maint',
  }

  test('production + 全部密钥齐备 → 通过', () => {
    expect(assertProductionSecrets({ ...validProd })).toBeUndefined()
  })

  test.each(['DATABASE_URL', 'PAYMENT_WEBHOOK_SECRET', 'OPENAI_API_KEY', 'MAINTENANCE_SECRET'])(
    'production 缺少 %s → 抛错阻断启动',
    (key) => {
      const env = { ...validProd }
      delete env[key]
      expect(() => assertProductionSecrets(env)).toThrow(key)
    }
  )

  test('占位值（your-*-here）视同缺失', () => {
    const env = { ...validProd, PAYMENT_WEBHOOK_SECRET: 'your-payment-webhook-secret-here' }
    expect(listMissingSecrets(env)).toContainEqual(expect.stringContaining('PAYMENT_WEBHOOK_SECRET'))
    expect(() => assertProductionSecrets(env)).toThrow('PAYMENT_WEBHOOK_SECRET')
  })

  test('非 production 不校验（开发/测试放行）', () => {
    expect(assertProductionSecrets({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBeUndefined()
    expect(assertProductionSecrets({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBeUndefined()
  })

  test('SECRET_FAIL_FAST=false 可降级放行（过渡期）', () => {
    const env: NodeJS.ProcessEnv = { ...validProd, SECRET_FAIL_FAST: 'false' }
    delete env.DATABASE_URL
    expect(assertProductionSecrets(env)).toBeUndefined()
  })

  test('listMissingSecrets 返回全部缺失项', () => {
    const env = { ...validProd }
    delete env.OPENAI_API_KEY
    delete env.MAINTENANCE_SECRET
    const missing = listMissingSecrets(env)
    expect(missing).toHaveLength(2)
    expect(missing.join()).toContain('OPENAI_API_KEY')
    expect(missing.join()).toContain('MAINTENANCE_SECRET')
  })
})
