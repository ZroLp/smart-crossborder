/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '@/components/Sidebar';
import zhDict from '@/lib/i18n/locales/zh';

// P9-01：修复既有失败——原 mock `t: key => key` 渲染原始 i18n 键，与 P4-05 五语种改造
// 后的断言（期望中文文案）不符。改为按 zh 字典解析，测试直接断言真实渲染文案。
function zh(key: string): string {
  let cur: unknown = zhDict;
  for (const k of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return key;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === 'string' ? cur : key;
}

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, 'data-testid': `link-${href}`, ...props }, children);
  };
});

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

jest.mock('@/lib/i18n/use-translation', () => {
  // 工厂被 ts-jest 提升到 import 之前，不能引用模块级变量；用 requireActual 取 zh 字典
  const dict = jest.requireActual('@/lib/i18n/locales/zh').default;
  const resolve = (obj: unknown, path: string): string | undefined => {
    let cur: unknown = obj;
    for (const k of path.split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[k];
    }
    return typeof cur === 'string' ? cur : undefined;
  };
  return {
    useTranslation: () => ({
      t: (key: string) => resolve(dict, key) ?? key,
      locale: 'zh',
    }),
  };
});

jest.mock('next/image', () => {
  return ({ src, alt, width, height }: any) => {
    return React.createElement('img', { src, alt, width, height, 'data-testid': 'logo-image' });
  };
});

jest.mock('@/components/AIBadge', () => {
  return function MockAIBadge() {
    return React.createElement('span', { 'data-testid': 'ai-badge', className: 'text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full' }, 'AI');
  };
});

describe('Sidebar', () => {
  test('renders brand name and logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('跨境智卖')).toBeInTheDocument();
    expect(screen.getByTestId('logo-image')).toBeInTheDocument();
  });

  test('renders all navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText(zh('nav.dashboard'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.selection'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.storeBuilder'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.content'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.adOptimizer'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.customerService'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.fulfillment'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.dataCenter'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.compliance'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.taskLogs'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.profile'))).toBeInTheDocument();
    expect(screen.getByText(zh('nav.settings'))).toBeInTheDocument();
  });

  test('renders exactly 12 navigation items', () => {
    render(<Sidebar />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(12);
  });

  test('renders AI badges on 6 AI-powered features', () => {
    render(<Sidebar />);
    const aiBadges = screen.getAllByTestId('ai-badge');
    expect(aiBadges).toHaveLength(6);
  });

  test('dashboard link is active when on dashboard page', () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByTestId('link-/dashboard');
    expect(dashboardLink.className).toContain('bg-primary/10');
    expect(dashboardLink.className).toContain('border-primary');
  });

  test('renders emoji icons for each nav item', () => {
    render(<Sidebar />);
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('🏪')).toBeInTheDocument();
    expect(screen.getByText('✍️')).toBeInTheDocument();
    expect(screen.getByText('📢')).toBeInTheDocument();
    expect(screen.getByText('💬')).toBeInTheDocument();
    expect(screen.getByText('📦')).toBeInTheDocument();
    expect(screen.getByText('📈')).toBeInTheDocument();
    expect(screen.getByText('🛡️')).toBeInTheDocument();
    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText('👤')).toBeInTheDocument();
    expect(screen.getByText('⚙️')).toBeInTheDocument();
  });

  test('has correct sidebar width and positioning', () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-[240px]');
    expect(aside).toHaveClass('fixed');
    expect(aside).toHaveClass('left-0');
    expect(aside).toHaveClass('top-0');
  });

  test('logo has correct dimensions', () => {
    render(<Sidebar />);
    const logo = screen.getByTestId('logo-image');
    expect(logo).toHaveAttribute('width', '32');
    expect(logo).toHaveAttribute('height', '32');
  });
});
