/**
 * @jest-environment jsdom
 *
 * P9-02 E2E 主链路 + 多语种冒烟（jsdom 渲染级，不开真实浏览器）。
 *
 * ① 主链路：login 页渲染 → 填注册表单 → submit → mock 全局 fetch 返回注册成功
 *    （含 set-cookie）→ 断言进入"已登录"成功态（user-panel 出现）。
 * ② 多语种：以 zh / en / fr / de / es 渲染 login + dashboard + consent banner，
 *    断言关键 data-testid 存在；非 CJK 语种断言渲染文本无中文字符泄漏
 *    （/[\u4e00-\u9fff]/ 0 命中，只查 textContent，不查源码常量）。
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LocaleContext } from '@/lib/i18n/locale-context'
import type { Locale } from '@/lib/i18n'

type LocaleContextValue = React.ContextType<typeof LocaleContext>

// ---- next/navigation：绝对 URL 环境下 useRouter/useSearchParams 最小 mock ----
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

// ---- 埋点：避免真实 fire-and-forget fetch 污染全局 mock 计数 ----
jest.mock('@/lib/analytics/track-event', () => ({
  trackEvent: jest.fn(),
}))

// ---- 登录态：可受控的 useAuth（refresh 成功后注入 user，驱动"成功态"渲染） ----
const mockAuthState: {
  user: { id: number; username: string; email: string | null; role: string } | null
} = { user: null }
const mockLogoutFn = jest.fn(async () => {
  mockAuthState.user = null
})
const mockRefreshFn = jest.fn(async () => {
  mockAuthState.user = { id: 42, username: 'smoke_user', email: null, role: 'viewer' }
  return mockAuthState.user
})
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    role: mockAuthState.user?.role ?? null,
    loading: false,
    authenticated: Boolean(mockAuthState.user),
    refresh: mockRefreshFn,
    logout: mockLogoutFn,
  }),
  AuthContext: (() => {
    const actual = jest.requireActual('react')
    const ctx = actual.createContext(null)
    const Provider = ({ children }: { children: React.ReactNode }) =>
      actual.createElement(ctx.Provider, { value: null }, children)
    return { ...ctx, Provider }
  })(),
}))

import LoginPage from '@/app/login/page'
import DashboardPage from '@/app/dashboard/page'
import ConsentBanner from '@/components/ConsentBanner'

const CJK_RE = /[\u4e00-\u9fff]/

function localeValue(locale: Locale): LocaleContextValue {
  return {
    locale,
    setLocale: () => {},
    timezone: locale === 'zh' ? 'Asia/Shanghai' : 'UTC',
    setTimezone: () => {},
    currency: 'USD',
    setCurrency: () => {},
    userId: null,
    loading: false,
  }
}

/** 主链路 / 多语种共用的 fetch mock：按 URL 分流。 */
function installFetchMock(): jest.Mock {
  const mockFetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/auth')) {
      // 注册成功 + set-cookie（服务端 Set-Cookie 语义的渲染级模拟）
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === 'set-cookie' ? 'sumaitong_session=smoke-token' : null) },
        json: async () => ({ success: true, userId: 42, role: 'viewer', email: null }),
      })
    }
    if (url.includes('/api/dashboard/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ revenue: '100', orders: 2, roas: '4.5', csRate: '98', hasData: true }),
      })
    }
    if (url.includes('/api/compliance')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { riskItems: [] } }) })
    }
    if (url.includes('/api/consent')) {
      // 未记录同意 → 横幅应展示
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: { records: [] } }) })
    }
    if (url.includes('/api/shop')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              id: 1,
              user_id: 42,
              shop_name: 'Demo Store',
              domain: 'demo.myshopify.com',
              access_token: '',
              scope: '',
              status: 'active',
              created_at: '',
              updated_at: '',
            },
          ],
        }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
  }) as jest.Mock
  global.fetch = mockFetch as unknown as typeof fetch
  return mockFetch
}

beforeEach(() => {
  mockAuthState.user = null
  jest.clearAllMocks()
})

describe('P9-02 主链路（login → register → 成功态）', () => {
  test('填写注册表单并提交：fetch 注册成功 + set-cookie 后进入 user-panel 成功态', async () => {
    const mockFetch = installFetchMock()

    render(
      <LocaleContext.Provider value={localeValue('en')}>
        <LoginPage />
      </LocaleContext.Provider>
    )

    // 关键 testid 齐备
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    const username = screen.getByTestId('username')
    const password = screen.getByTestId('password')
    const submit = screen.getByTestId('submit')

    // 切到注册页签（en 语种下按钮文案为 Register）
    fireEvent.click(screen.getAllByRole('button', { name: 'Register' })[0])

    // 填写表单（注册态下 username/password testid 仍唯一）
    fireEvent.change(username, { target: { value: 'smoke_user' } })
    fireEvent.change(password, { target: { value: 'Password123' } })
    fireEvent.change(screen.getByPlaceholderText('Re-enter password'), { target: { value: 'Password123' } })
    fireEvent.click(submit)

    // 断言注册请求与 set-cookie 语义
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth',
        expect.objectContaining({ method: 'POST' })
      )
    })
    const authCall = mockFetch.mock.calls.find((args) => String(args[0]).includes('/api/auth'))
    const sentBody = JSON.parse(String(authCall![1].body))
    expect(sentBody.action).toBe('register')
    expect(sentBody.username).toBe('smoke_user')

    // 注册成功 → refresh() → user-panel（已登录成功态）
    await waitFor(() => {
      expect(screen.getByTestId('user-panel')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
  })
})

describe('P9-02 多语种冒烟（login + dashboard + consent banner）', () => {
  const locales: Array<{ code: Locale; cjk: boolean }> = [
    { code: 'zh', cjk: true },
    { code: 'en', cjk: false },
    { code: 'fr', cjk: false },
    { code: 'de', cjk: false },
    { code: 'es', cjk: false },
  ]

  locales.forEach(({ code, cjk }) => {
    test(`${code}: 关键 testid 存在且${cjk ? '中文可正常渲染' : '无中文字符泄漏'}`, async () => {
      installFetchMock()

      const { container } = render(
        <LocaleContext.Provider value={localeValue(code)}>
          <LoginPage />
          <DashboardPage />
          <ConsentBanner />
        </LocaleContext.Provider>
      )

      // 关键 testid
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.getByTestId('username')).toBeInTheDocument()
      expect(screen.getByTestId('password')).toBeInTheDocument()
      expect(screen.getByTestId('submit')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
      // dashboard 统计卡：等待 stats fetch 完成后渲染
      await waitFor(() => {
        expect(screen.getByTestId('stats-cards')).toBeInTheDocument()
      })
      // consent 横幅：未同意 → 展示
      await waitFor(() => {
        expect(screen.getByTestId('consent-banner')).toBeInTheDocument()
      })

      // 中文字符泄漏检查（只查渲染文本）
      const text = container.textContent ?? ''
      if (cjk) {
        expect(CJK_RE.test(text)).toBe(true)
      } else {
        expect(CJK_RE.test(text)).toBe(false)
      }
    })
  })
})
