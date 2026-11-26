import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { UserRepository } from '@/lib/db/user-repository'
import { hashPassword } from '@/lib/auth/password-hash'
import { POST as trackPOST } from '@/app/api/analytics/track/route'
import { GET as consentGET, POST as consentPOST } from '@/app/api/consent/route'
import { GET as dsarGET, POST as dsarPOST } from '@/app/api/privacy/dsar/route'
import { POST as retentionPOST } from '@/app/api/maintenance/data-retention/route'
import { POST as residencyPOST } from '@/app/api/privacy/residency/route'
import { GET as transferGET } from '@/app/api/privacy/transfer-mechanisms/route'
import { GET as policyGET } from '@/app/api/legal/policy/route'
import { GET as breachGET, POST as breachPOST } from '@/app/api/admin/breach/route'
import { GET as breachTemplatesGET } from '@/app/api/legal/breach-templates/route'
import { GET as dnssGET, POST as dnssPOST } from '@/app/api/privacy/dnss/route'
import { GET as piplGET } from '@/app/api/privacy/pipl-assessment/route'

let db: DbClient

function post(url: string, body: object, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function getUrl(url: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { headers: cookie ? { cookie } : {} })
}

async function makeUser(username: string, role = 'viewer'): Promise<{ cookie: string; userId: number }> {
  const userRepo = new UserRepository(db)
  await userRepo.create({ username, password: hashPassword('Str0ngPass!'), email: `${username}@example.com` })
  const id = Number((await userRepo.findByUsername(username))!.id)
  if (role !== 'viewer') {
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  }

  const response = await (await import('@/app/api/auth/route')).POST(
    new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'P701Test/1.0', 'x-forwarded-for': '10.1.0.7' },
      body: JSON.stringify({ action: 'login', username, password: 'Str0ngPass!' }),
    })
  )
  const setCookie = response.headers.get('set-cookie') || ''
  const match = setCookie.match(/sumaitong_session=([^;]+)/)
  return { cookie: match ? `sumaitong_session=${match[1]}` : '', userId: id }
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
})

afterEach(async () => {
  await db.close()
})

describe('P7-01 阻断式同意管理', () => {
  test('401 without session', async () => {
    expect((await consentGET(getUrl('/api/consent'))).status).toBe(401)
    expect((await consentPOST(post('/api/consent', { purpose: 'analytics', consented: true }))).status).toBe(401)
  })

  test('non-essential events are 403 CONSENT_REQUIRED without consent', async () => {
    const bob = await makeUser('bob')
    for (const event of ['task_submitted', 'task_completed', 'shop_connected']) {
      const res = await trackPOST(post('/api/analytics/track', { eventName: event }, bob.cookie))
      expect(res.status).toBe(403)
      expect((await res.json()).code).toBe('CONSENT_REQUIRED')
    }
  })

  test('signup event is exempt (no consent needed)', async () => {
    const bob = await makeUser('bob')
    const res = await trackPOST(post('/api/analytics/track', { eventName: 'signup', source: 'utm:blog' }, bob.cookie))
    expect(res.status).toBe(202)
  })

  test('consenting analytics unblocks tracking; GET reflects state', async () => {
    const bob = await makeUser('bob')
    const ok = await consentPOST(post('/api/consent', { purpose: 'analytics', consented: true }, bob.cookie))
    expect(ok.status).toBe(200)
    expect((await trackPOST(post('/api/analytics/track', { eventName: 'task_submitted' }, bob.cookie))).status).toBe(202)

    const list = await consentGET(getUrl('/api/consent', bob.cookie))
    const records = (await list.json()).data.records as Array<{ purpose: string; consented: boolean }>
    expect(records.find((r) => r.purpose === 'analytics')).toMatchObject({ purpose: 'analytics', consented: true })
  })

  test('invalid purpose / non-boolean consented → 400', async () => {
    const bob = await makeUser('bob')
    expect((await consentPOST(post('/api/consent', { purpose: 'marketing', consented: true }, bob.cookie))).status).toBe(400)
    expect((await consentPOST(post('/api/consent', { purpose: 'analytics', consented: 'yes' }, bob.cookie))).status).toBe(400)
  })

  test('withdrawal re-gates: consent → track 202 → withdraw → 403 again', async () => {
    const bob = await makeUser('bob')
    await consentPOST(post('/api/consent', { purpose: 'analytics', consented: true }, bob.cookie))
    expect((await trackPOST(post('/api/analytics/track', { eventName: 'task_submitted' }, bob.cookie))).status).toBe(202)

    const withdrawn = await consentPOST(post('/api/consent', { purpose: 'analytics', consented: false }, bob.cookie))
    expect(withdrawn.status).toBe(200)
    expect((await trackPOST(post('/api/analytics/track', { eventName: 'task_submitted' }, bob.cookie))).status).toBe(403)

    const row = (await db.prepare('SELECT withdrawn_at FROM consent_records WHERE user_id = ? AND purpose = ?').get(bob.userId, 'analytics')) as { withdrawn_at: string | null }
    expect(row.withdrawn_at).not.toBeNull()
  })
})

describe('P7-02 DSAR 自助（30 天 SLA）', () => {
  test('export is fulfilled immediately with JSON snapshot and +30d SLA', async () => {
    const bob = await makeUser('bob')
    const res = await dsarPOST(post('/api/privacy/dsar', { type: 'export' }, bob.cookie))
    expect(res.status).toBe(200)
    const data = (await res.json()).data as { id: number; dsar_type: string; status: string; sla_due_at: string }
    expect(data.dsar_type).toBe('export')
    expect(data.status).toBe('fulfilled')
    expect(typeof data.sla_due_at).toBe('string')

    const row = (await db.prepare('SELECT export_json FROM dsar_requests WHERE id = ?').get(data.id)) as { export_json: string }
    const snapshot = JSON.parse(row.export_json)
    expect(snapshot.users).toHaveLength(1)
    expect(snapshot).toHaveProperty('orders')
    expect(snapshot).toHaveProperty('consent_records')

    const days = (await db.prepare('SELECT date_part(\'day\', sla_due_at - requested_at) AS days FROM dsar_requests WHERE id = ?').get(data.id)) as { days: number }
    expect(days.days).toBe(30)
  })

  test('delete scrubs PII: email NULL, username anonymized, request fulfilled', async () => {
    const bob = await makeUser('bob')
    const res = await dsarPOST(post('/api/privacy/dsar', { type: 'delete' }, bob.cookie))
    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('fulfilled')

    const userRow = (await db.prepare('SELECT email, username FROM users WHERE id = ?').get(bob.userId)) as { email: string | null; username: string }
    expect(userRow.email).toBeNull()
    expect(userRow.username.startsWith('deleted-')).toBe(true)
  })

  test('unknown dsar type → 400', async () => {
    const bob = await makeUser('bob')
    expect((await dsarPOST(post('/api/privacy/dsar', { type: 'export_all' }, bob.cookie))).status).toBe(400)
  })

  test('GET returns own request history only', async () => {
    const bob = await makeUser('bob')
    const carol = await makeUser('carol')
    await dsarPOST(post('/api/privacy/dsar', { type: 'export' }, bob.cookie))
    await dsarPOST(post('/api/privacy/dsar', { type: 'export' }, carol.cookie))

    const res = await dsarGET(getUrl('/api/privacy/dsar', bob.cookie))
    expect(res.status).toBe(200)
    const requests = (await res.json()).data.requests
    expect(requests).toHaveLength(1)
  })
})

describe('P7-03 数据保留期配置 + 自动清理', () => {
  test('policies are seeded (6 data types, sessions = 90d)', async () => {
    const rows = (await db.prepare('SELECT data_type, max_age_days FROM data_retention_policies').all()) as Array<{ data_type: string; max_age_days: number }>
    expect(rows).toHaveLength(6)
    expect(Object.fromEntries(rows.map((r) => [r.data_type, r.max_age_days]))).toMatchObject({
      sessions: 90,
      analytics_events: 365,
      task_logs: 365,
      email_verification_codes: 30,
      sms_verification_codes: 30,
      compliance_events: 365,
    })
  })

  test('admin cleanup deletes expired sessions, expired row disappears', async () => {
    const victim = await makeUser('victim')
    const admin = await makeUser('admin', 'admin')

    await db.prepare('UPDATE sessions SET created_at = now() - interval \'91 days\' WHERE user_id = ?').run(victim.userId)
    const before = (await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(victim.userId)) as { n: number }
    expect(before.n).toBeGreaterThanOrEqual(1)

    const res = await retentionPOST(post('/api/maintenance/data-retention', {}, admin.cookie))
    expect(res.status).toBe(200)
    expect((await res.json()).cleaned.sessions).toBeGreaterThanOrEqual(1)

    const after = (await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(victim.userId)) as { n: number }
    expect(after.n).toBe(0)
  })

  test('non-admin → 403', async () => {
    const bob = await makeUser('bob')
    const res = await retentionPOST(post('/api/maintenance/data-retention', {}, bob.cookie))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('FORBIDDEN')
  })
})

describe('P7-04 跨境（SCC/DPF + 区域化选项）', () => {
  test('POST residency: EU accepted and persisted', async () => {
    const bob = await makeUser('bob')
    const res = await residencyPOST(post('/api/privacy/residency', { region: 'EU' }, bob.cookie))
    expect(res.status).toBe(200)
    const row = (await db.prepare('SELECT data_residency FROM users WHERE id = ?').get(bob.userId)) as { data_residency: string }
    expect(row.data_residency).toBe('EU')
  })

  test('POST residency: MARS rejected with 400', async () => {
    const bob = await makeUser('bob')
    expect((await residencyPOST(post('/api/privacy/residency', { region: 'MARS' }, bob.cookie))).status).toBe(400)
  })

  test('GET transfer-mechanisms lists SCC / DPF / PIPL and current residency', async () => {
    const bob = await makeUser('bob')
    await residencyPOST(post('/api/privacy/residency', { region: 'EU' }, bob.cookie))

    const res = await transferGET(getUrl('/api/privacy/transfer-mechanisms', bob.cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('SCC')
    expect(JSON.stringify(body)).toContain('DPF')
    expect(JSON.stringify(body)).toContain('2021/914')
    expect(JSON.stringify(body)).toContain('38/39')
    expect(body.data.data_residency).toBe('EU')
  })
})

describe('P7-05 政策/协议页可下载', () => {
  test('GET ?type=privacy → 200 text/plain attachment', async () => {
    const res = await policyGET(getUrl('/api/legal/policy?type=privacy'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="privacy_policy.txt"')
    const text = await res.text()
    expect(text).toContain('隐私政策')
    expect(text).toContain('生效日期')
  })

  test('terms / dpa download; invalid type → 400', async () => {
    expect((await policyGET(getUrl('/api/legal/policy?type=terms'))).status).toBe(200)
    expect((await policyGET(getUrl('/api/legal/policy?type=dpa'))).status).toBe(200)
    expect((await policyGET(getUrl('/api/legal/policy?type=xxx'))).status).toBe(400)
  })
})

describe('P7-06 泄露 72h 响应', () => {
  test('admin POST breach → 201 with deadline = detected_at + 72h', async () => {
    const admin = await makeUser('admin', 'admin')
    const bob = await makeUser('bob')

    const res = await breachPOST(post('/api/admin/breach', { description: '客户邮箱字段外泄', user_id: bob.userId }, admin.cookie))
    expect(res.status).toBe(201)
    const data = (await res.json()).data as { id: number; status: string; detected_at: string; notification_deadline_at: string }
    expect(data.status).toBe('open')

    // 72h deadline 校验：总小时数 = day*24 + hour（pglite 的 date_part('hour', 整日 interval) 只返回小时位 0，
    // 而真实 Postgres 返回折算总量；此写法两种引擎下均等于 72）。
    const hours = (await db.prepare(
      "SELECT date_part('day', notification_deadline_at - detected_at) * 24 + date_part('hour', notification_deadline_at - detected_at) AS h FROM breach_reports WHERE id = ?"
    ).get(data.id)) as { h: number }
    expect(hours.h).toBe(72)
  })

  test('non-admin POST breach → 403; GET list requires admin', async () => {
    const bob = await makeUser('bob')
    expect((await breachPOST(post('/api/admin/breach', { description: 'x' }, bob.cookie))).status).toBe(403)
    expect((await breachGET(getUrl('/api/admin/breach', bob.cookie))).status).toBe(403)
  })

  test('GET /api/admin/breach lists reports; legal templates carry 72h text', async () => {
    const admin = await makeUser('admin', 'admin')
    await breachPOST(post('/api/admin/breach', { description: 'token 泄露' }, admin.cookie))

    const list = await breachGET(getUrl('/api/admin/breach', admin.cookie))
    expect(list.status).toBe(200)
    expect((await list.json()).data.reports).toHaveLength(1)

    const templates = await breachTemplatesGET()
    const data = (await templates.json()).data
    expect(templates.status).toBe(200)
    expect(data.regulator).toContain('72 小时')
    expect(data.data_subject).toContain('72 小时')
  })
})

describe('P7-07 Do Not Sell/Share（CCPA/CPRA）', () => {
  test('default false; POST true → GET true', async () => {
    const bob = await makeUser('bob')
    const initial = await dnssGET(getUrl('/api/privacy/dnss', bob.cookie))
    const initialBody = await initial.json()
    expect(initialBody.data.doNotSell).toBe(false)
    expect(initialBody.data.jurisdiction).toBe('CA/US')

    const setRes = await dnssPOST(post('/api/privacy/dnss', { doNotSell: true }, bob.cookie))
    expect(setRes.status).toBe(200)

    const after = await dnssGET(getUrl('/api/privacy/dnss', bob.cookie))
    expect((await after.json()).data.doNotSell).toBe(true)
    const row = (await db.prepare('SELECT do_not_sell FROM users WHERE id = ?').get(bob.userId)) as { do_not_sell: boolean }
    expect(row.do_not_sell).toBe(true)
  })

  test('non-boolean doNotSell → 400', async () => {
    const bob = await makeUser('bob')
    expect((await dnssPOST(post('/api/privacy/dnss', { doNotSell: 'yes' }, bob.cookie))).status).toBe(400)
  })
})

describe('P7-08 PIPL 单独同意 + 跨境评估归档', () => {
  test('default: no separate consent, archived_at null, PIPL basis', async () => {
    const bob = await makeUser('bob')
    const res = await piplGET(getUrl('/api/privacy/pipl-assessment', bob.cookie))
    expect(res.status).toBe(200)
    const data = (await res.json()).data as Record<string, any>
    expect(data.basis).toBe('PIPL 第 38/39/40 条')
    expect(data.assessment.mechanism).toBe('标准合同 + 单独同意')
    expect(data.assessment.separate_consent).toBeNull()
    expect(data.assessment.regionalization).toBe('CN')
    expect(data.archived_at).toBeNull()
  })

  test('after pipl_cross_border consent, assessment archives the record', async () => {
    const bob = await makeUser('bob')
    const consentRes = await consentPOST(post('/api/consent', { purpose: 'pipl_cross_border', consented: true }, bob.cookie))
    expect(consentRes.status).toBe(200)

    const res = await piplGET(getUrl('/api/privacy/pipl-assessment', bob.cookie))
    const data = (await res.json()).data as Record<string, any>
    expect(JSON.stringify(data.assessment.separate_consent)).toContain('pipl_cross_border')
    expect(data.assessment.separate_consent.consented).toBe(true)
    expect(data.archived_at).not.toBeNull()
  })
})
