/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useParams: () => ({ id: 'not-found-id' }),
}))

import CompliancePage from '@/app/dashboard/compliance/page'
import AdOptimizerPage from '@/app/dashboard/ad-optimizer/page'
import AdCampaignDetailPage from '@/app/dashboard/ad-optimizer/[id]/page'
import OrdersPage from '@/app/dashboard/orders/page'
import ProfilePage from '@/app/dashboard/profile/page'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }
}

const emptyCompliance = {
  success: true,
  data: {
    policyUpdates: [],
    taxReminders: [],
    complianceChecks: [],
    riskItems: [],
    suggestions: [],
  },
}

function mockFetch(handler: (url: string) => unknown) {
  const fn = jest.fn(async (url: string) => handler(url))
  ;(global as any).fetch = fn
  return fn
}

describe('F-04 pages use API data and empty states (no mock fallback)', () => {
  test('compliance page shows empty states when API returns empty groups', async () => {
    mockFetch((url) => {
      if (url.includes('/api/compliance')) return jsonResponse(emptyCompliance)
      return jsonResponse({ success: true, data: [] })
    })

    render(<CompliancePage />)

    expect(await screen.findByText('暂无政策更新')).toBeInTheDocument()
    expect(screen.getByText('暂无税务提醒')).toBeInTheDocument()
    expect(screen.getByText('暂无检测项')).toBeInTheDocument()
    expect(screen.getByText('暂无风险项')).toBeInTheDocument()
    expect(screen.getByText('暂无整改建议')).toBeInTheDocument()
  })

  test('ad-optimizer list shows empty states when API returns empty arrays', async () => {
    mockFetch((url) => {
      if (url.includes('/api/ad-campaigns')) {
        return jsonResponse({ success: true, data: { campaigns: [], suggestions: [] } })
      }
      return jsonResponse({ success: true, data: [] })
    })

    render(<AdOptimizerPage />)

    expect(await screen.findByText('暂无广告活动')).toBeInTheDocument()
    expect(screen.getByText('暂无优化建议')).toBeInTheDocument()
  })

  test('ad-optimizer detail shows empty state for unknown id', async () => {
    mockFetch(() =>
      jsonResponse(
        { success: false, code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' },
        404
      )
    )

    render(<AdCampaignDetailPage />)

    expect(await screen.findByText('未找到该广告活动')).toBeInTheDocument()
  })

  test('orders page shows empty state when API returns no orders', async () => {
    mockFetch(() => jsonResponse({ success: true, data: [] }))

    render(<OrdersPage />)

    expect(await screen.findByText('暂无订单')).toBeInTheDocument()
  })

  test('profile page renders API user and empty session state', async () => {
    mockFetch((url) => {
      if (url.includes('/api/profile')) {
        return jsonResponse({
          success: true,
          data: {
            user: {
              id: 1,
              username: 'alice',
              email: 'alice@example.com',
              role: 'admin',
              created_at: '2026-01-02 03:04:05',
            },
            preferences: null,
            sessions: [],
          },
        })
      }
      return jsonResponse({ success: true, data: [] })
    })

    render(<ProfilePage />)

    expect((await screen.findAllByText('alice')).length).toBeGreaterThan(0)
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('管理员').length).toBeGreaterThan(0)
    expect(screen.getByText('暂无登录记录')).toBeInTheDocument()
    expect(screen.getAllByText(/当前已登录设备数/).length).toBeGreaterThan(0)
  })
})
