/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/components/SkeletonLoader', () => {
  return function MockSkeletonLoader() {
    return <div data-testid="skeleton-loader" />
  }
})

import AdminOverviewPage from '@/app/admin/page'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AdminOverviewPage', () => {
  test('renders the page with title containing 运营', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { totalUsers: 10, totalShops: 2, totalOrders: 50, totalGMV: 10000 },
      }),
    })

    render(<AdminOverviewPage />)

    await waitFor(() => {
      expect(screen.getByText('运营总览')).toBeInTheDocument()
    })
  })

  test('renders loading skeleton before data loads', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    render(<AdminOverviewPage />)

    expect(screen.getAllByTestId('skeleton-loader').length).toBeGreaterThan(0)
  })

  test('renders no-data message when stats are null after fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    })

    render(<AdminOverviewPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无运营数据')).toBeInTheDocument()
    })
  })
})
