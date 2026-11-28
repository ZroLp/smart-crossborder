import type { DbClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'
import { initDatabase } from '@/lib/db/init'
import { applyDbCompat } from '../helpers/db-compat'
import { quoteTax } from '@/lib/tax/tax-service'
import { GET as quoteGET } from '@/app/api/tax/quote/route'

let db: DbClient

function getUrl(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`)
}

beforeEach(async () => {
  db = applyDbCompat(initDatabase(':memory:'))
})

afterEach(async () => {
  await db.close()
})

describe('quoteTax (P6-05)', () => {
  test('EU VAT below €150 → IOSS note', async () => {
    const quote = await quoteTax(db, { amountCents: 10000, country: 'DE' })
    expect(quote.regime).toBe('VAT')
    expect(quote.ratePct).toBeCloseTo(19)
    expect(quote.taxAmountCents).toBe(1900)
    expect(quote.grossAmountCents).toBe(11900)
    expect(quote.notes.join(' ')).toMatch(/IOSS/)
  })

  test('EU VAT above €150 → OSS note', async () => {
    const quote = await quoteTax(db, { amountCents: 15001, country: 'FR' })
    expect(quote.notes.join(' ')).toMatch(/OSS/)
  })

  test('US with state uses the state rate', async () => {
    const quote = await quoteTax(db, { amountCents: 10000, country: 'US', state: 'CA' })
    expect(quote.regime).toBe('US_SALES_TAX')
    expect(quote.ratePct).toBeCloseTo(7.25)
    expect(quote.taxAmountCents).toBe(725)
  })

  test('US without state → 0% + economic nexus note', async () => {
    const quote = await quoteTax(db, { amountCents: 10000, country: 'US' })
    expect(quote.ratePct).toBe(0)
    expect(quote.notes.join(' ')).toMatch(/nexus/)
  })

  test('Japan JCT 10%', async () => {
    const quote = await quoteTax(db, { amountCents: 3000, country: 'JP' })
    expect(quote.regime).toBe('JCT')
    expect(quote.taxAmountCents).toBe(300)
  })

  test('domestic CN is exempt', async () => {
    const quote = await quoteTax(db, { amountCents: 7980, country: 'CN' })
    expect(quote.regime).toBe('EXEMPT')
    expect(quote.taxAmountCents).toBe(0)
  })
})

describe('GET /api/tax/quote (P6-05)', () => {
  test('valid quote', async () => {
    const res = await quoteGET(getUrl('/api/tax/quote?amount=7980&country=ES'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.regime).toBe('VAT')
    expect(body.data.taxAmountCents).toBe(1676)
  })

  test('missing params → 400', async () => {
    const res = await quoteGET(getUrl('/api/tax/quote?amount=100'))
    expect(res.status).toBe(400)
  })

  test('invalid amount → 400', async () => {
    const res = await quoteGET(getUrl('/api/tax/quote?amount=abc&country=DE'))
    expect(res.status).toBe(400)
  })

  test('unknown country still quotes (0% + advisory note)', async () => {
    const res = await quoteGET(getUrl('/api/tax/quote?amount=1000&country=XX'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.regime).toBe('EXEMPT')
    expect(body.data.notes.join(' ')).toMatch(/no configured rate/)
  })
})
