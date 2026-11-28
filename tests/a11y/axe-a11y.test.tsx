/**
 * @jest-environment jsdom
 *
 * P4-06 WCAG 2.1 AA — axe-core 自动化可访问性测试。
 * 对一组代表性页面/组件运行 axe.run（wcag2a/wcag2aa/wcag21a/wcag21aa），
 * 断言 critical 与 serious 违规数为 0，并验证键盘可达性。
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import axe from 'axe-core'

// next/navigation：login（useRouter/useSearchParams）、TopBar/Sidebar（usePathname）、
// dashboard（useRouter）、f04 系（useParams）统一 mock，与既有页面测试一致。
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => '/dashboard',
  useParams: () => ({}),
}))

// next/link（Sidebar）→ 原生 anchor；next/image（Logo）→ 原生 img 且保留 alt。
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return React.createElement('a', { href, 'data-testid': `link-${href}`, ...props }, children)
  }
})

jest.mock('next/image', () => {
  return function MockImage({ src, alt, width, height, ...props }: any) {
    return React.createElement('img', { src, alt, width, height, ...props })
  }
})

// VoiceInputButton 依赖 Web Speech API；jsdom 无该 API，mock 为"受支持"，
// 使按钮真实渲染并验证其 aria-label 与键盘可达性。
jest.mock('@/lib/speech/web-speech', () => ({
  getSpeechService: () => ({
    isSupported: () => true,
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    startRecognition: jest.fn(() => ({ unsubscribe: jest.fn() })),
    stopRecognition: jest.fn(),
  }),
}))

import TopBar from '@/components/TopBar'
import Sidebar from '@/components/Sidebar'
import AgentStatusCard from '@/components/AgentStatusCard'
import AIStepProgress from '@/components/AIStepProgress'
import DemoDataNotice from '@/components/DemoDataNotice'
import OfflineIndicator from '@/components/OfflineIndicator'
import RiskAlertPopup, { type RiskAlert } from '@/components/RiskAlertPopup'
import SettingsDropdowns from '@/components/SettingsDropdowns'
import VoiceInputButton from '@/components/VoiceInputButton'
import LoginPage from '@/app/login/page'
import DashboardPage from '@/app/dashboard/page'

const sampleSteps = [
  { step: 'data-collection', label: '数据采集', status: 'completed' as const, duration: 1200 },
  { step: 'model-reasoning', label: '模型推理', status: 'running' as const },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' as const },
]

const sampleAlerts: RiskAlert[] = [
  {
    id: 'risk-1',
    type: 'compliance',
    title: '高风险项：目的国税务申报逾期',
    message: '德国 VAT 申报已逾期 3 天',
    link: '/dashboard/compliance',
  },
]

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }
}

// 组件级测试不渲染 app layout（layout 提供 <html lang>、<title> 与 <main> 地标），
// 因此：1) 在 jsdom 文档上补齐 lang/title（与 app/layout.tsx 一致）；
// 2) 关闭 region 规则（地标由 app/dashboard/layout.tsx 的 <main> 与 Sidebar 的
//    <aside> 提供，组件级容器没有完整文档地标结构）。
// color-contrast 等依赖样式计算的规则在 jsdom 下为 incomplete，不受影响。
const A11Y_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: { region: { enabled: false } },
}

function formatViolations(violations: axe.Result[]) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `  [${v.id}][${v.impact}] ${v.description} — ${v.nodes.length} node(s)`)
    .join('\n')
}

async function expectNoCriticalOrSerious(container: HTMLElement, label: string) {
  const results = await axe.run(container, A11Y_OPTIONS)
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  if (bad.length > 0) {
    console.log(`[axe][${label}] violations:\n${formatViolations(results.violations)}`)
  }
  expect(bad.map((v) => `[${v.id}] ${v.nodes.length} node(s)`)).toEqual([])
}

beforeEach(() => {
  document.title = '跨境智卖 — 可访问性测试'
  document.documentElement.setAttribute('lang', 'zh-CN')
  global.fetch = jest.fn()
})

afterEach(() => {
  delete (global as any).fetch
})

describe('P4-06 axe WCAG 2.1 AA — components & pages, 0 critical/serious violations', () => {
  test('TopBar', async () => {
    const { container } = render(<TopBar />)
    await expectNoCriticalOrSerious(container, 'TopBar')
  })

  test('Sidebar', async () => {
    const { container } = render(<Sidebar />)
    await expectNoCriticalOrSerious(container, 'Sidebar')
  })

  test('AgentStatusCard', async () => {
    const { container } = render(
      <AgentStatusCard name="选品Agent" type="选品Agent" status="online" taskCount={5} />
    )
    await expectNoCriticalOrSerious(container, 'AgentStatusCard')
  })

  test('AIStepProgress', async () => {
    const { container } = render(
      <AIStepProgress
        taskId="task-001"
        steps={sampleSteps}
        taskStatus="running"
        onPause={jest.fn()}
        onTerminate={jest.fn()}
        onRetry={jest.fn()}
      />
    )
    await expectNoCriticalOrSerious(container, 'AIStepProgress')
  })

  test('DemoDataNotice', async () => {
    const { container } = render(<DemoDataNotice>当前展示的数据为演示数据，仅供体验</DemoDataNotice>)
    await expectNoCriticalOrSerious(container, 'DemoDataNotice')
  })

  test('OfflineIndicator', async () => {
    const { container } = render(<OfflineIndicator isOnline={false} />)
    await expectNoCriticalOrSerious(container, 'OfflineIndicator')
  })

  test('RiskAlertPopup', async () => {
    const { container } = render(
      <RiskAlertPopup alerts={sampleAlerts} onClose={jest.fn()} onJump={jest.fn()} />
    )
    await expectNoCriticalOrSerious(container, 'RiskAlertPopup')
  })

  test('SettingsDropdowns', async () => {
    const { container } = render(<SettingsDropdowns />)
    await expectNoCriticalOrSerious(container, 'SettingsDropdowns')
  })

  test('VoiceInputButton', async () => {
    const { container } = render(<VoiceInputButton onResult={jest.fn()} />)
    await expectNoCriticalOrSerious(container, 'VoiceInputButton')
  })

  test('login page', async () => {
    const { container } = render(<LoginPage />)
    await expectNoCriticalOrSerious(container, 'LoginPage')
  })

  test('dashboard page', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes('/api/dashboard/stats')) {
        return jsonResponse({ revenue: '0', orders: 0, roas: '0', csRate: '0', hasData: false })
      }
      if (url.includes('/api/compliance')) {
        return jsonResponse({ success: true, data: { riskItems: [] } })
      }
      return jsonResponse({ success: true, data: [] })
    })

    const { container } = render(<DashboardPage />)
    // 等待首帧数据加载完成（骨架屏退出）后再执行 axe，覆盖真实渲染分支。
    await waitFor(() => {
      expect(screen.getAllByText('你还没有订单数据').length).toBeGreaterThan(0)
    })
    await expectNoCriticalOrSerious(container, 'DashboardPage')
  })
})

describe('P4-06 keyboard accessibility — Tab/focus reachability', () => {
  // 断言：所有可交互控件（button/input）无负 tabindex、未被移除出 tab 序，
  // 且可调用 focus() 获得焦点（等价于 Tab 可达）。
  function expectInteractivesKeyboardReachable(root: HTMLElement) {
    const interactives = Array.from(root.querySelectorAll('button, input, select'))
    expect(interactives.length).toBeGreaterThan(0)
    for (const el of interactives) {
      const tabIndex = el.getAttribute('tabindex')
      const value = tabIndex === null ? 0 : Number(tabIndex)
      expect(value).toBeGreaterThanOrEqual(0)
      if ((el as HTMLButtonElement).disabled) continue
      ;(el as HTMLElement).focus()
      expect(document.activeElement).toBe(el)
    }
    return interactives
  }

  test('login page: username/password inputs, login button, tab switch are focusable', () => {
    render(<LoginPage />)

    const username = screen.getByPlaceholderText('请输入用户名')
    const password = screen.getByPlaceholderText('请输入密码')
    const loginButtons = screen.getAllByRole('button', { name: '登录' })
    const registerTabs = screen.getAllByRole('button', { name: '注册' })

    for (const el of [username, password, ...loginButtons, ...registerTabs]) {
      const tabIndex = el.getAttribute('tabindex')
      const value = tabIndex === null ? 0 : Number(tabIndex)
      expect(value).toBeGreaterThanOrEqual(0)
      el.focus()
      expect(document.activeElement).toBe(el)
    }

    // 登录模式下全部可交互控件键盘可达
    expectInteractivesKeyboardReachable(document.body)
  })

  test('dashboard page: refresh button and quick actions are focusable', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes('/api/dashboard/stats')) {
        return jsonResponse({ revenue: '0', orders: 0, roas: '0', csRate: '0', hasData: false })
      }
      if (url.includes('/api/compliance')) {
        return jsonResponse({ success: true, data: { riskItems: [] } })
      }
      return jsonResponse({ success: true, data: [] })
    })

    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getAllByText('你还没有订单数据').length).toBeGreaterThan(0)
    })

    const refreshButton = screen.getByRole('button', { name: /刷新/ })
    expect(refreshButton).toBeInTheDocument()

    const interactives = expectInteractivesKeyboardReachable(document.body)
    // 刷新按钮 + 4 个快捷操作按钮
    expect(interactives.length).toBeGreaterThanOrEqual(5)
  })
})
