/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataCenterPage from '@/app/dashboard/data-center/page';

describe('DataCenterPage', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.includes('type=orders')
      ? [
          {
            id: 1,
            total_amount: 100,
            status: 'completed',
            created_at: '2025-05-30 10:00:00',
          },
          {
            id: 2,
            total_amount: 20,
            status: 'pending',
            created_at: '2025-05-30 11:00:00',
          },
        ]
      : [
          {
            id: 1,
            name: '真实商品 A',
            price: 12.5,
            sales: 8,
          },
        ];

    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data }),
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-05-30'));
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  async function renderDataCenter() {
    await act(async () => {
      render(<DataCenterPage />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('暂无流量数据')).toBeInTheDocument());
  }

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  test('renders page title and controls', async () => {
    await renderDataCenter();
    expect(screen.getByText('数据中心')).toBeInTheDocument();
    expect(screen.getByText('导出报表')).toBeInTheDocument();
  });

  test('renders 4 stat cards', async () => {
    await renderDataCenter();
    expect(screen.getByText('总营收')).toBeInTheDocument();
    expect(screen.getByText('总订单')).toBeInTheDocument();
    expect(screen.getByText('客单价')).toBeInTheDocument();
    expect(screen.getByText('转化率')).toBeInTheDocument();
  });

  test('aggregates real orders and products from the data API', async () => {
    await renderDataCenter();

    expect(await screen.findByText('¥120')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('真实商品 A')).toBeInTheDocument();
    expect(screen.getByText('¥100')).toBeInTheDocument();
    expect(screen.getByText('暂无流量数据')).toBeInTheDocument();
    expect(
      screen.getByText('暂无流量来源数据，接入访问统计后可查看')
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('renders chart sections', async () => {
    await renderDataCenter();
    expect(screen.getByText('📈 营收趋势')).toBeInTheDocument();
    expect(screen.getByText('📦 订单趋势')).toBeInTheDocument();
    expect(screen.getByText('🌐 流量来源')).toBeInTheDocument();
    expect(screen.getByText('🏆 商品排行')).toBeInTheDocument();
  });

  test('date range select has correct options', async () => {
    await renderDataCenter();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('7d');
    expect(screen.getByText('近7天')).toBeInTheDocument();
    expect(screen.getByText('近30天')).toBeInTheDocument();
    expect(screen.getByText('近90天')).toBeInTheDocument();
    expect(screen.getByText('自定义')).toBeInTheDocument();
  });

  test('date range change triggers data refresh', async () => {
    await renderDataCenter();
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: '30d' } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(select).toHaveValue('30d');
    return waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });

  test('export button creates blob and triggers download', async () => {
    const mockClick = jest.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement;

    const originalCreateObjectURL = global.URL.createObjectURL;
    const originalRevokeObjectURL = global.URL.revokeObjectURL;
    const originalCreateElement = global.document.createElement;

    const createdObjects: Blob[] = [];
    let revokedUrl = '';

    global.URL.createObjectURL = jest.fn((blob: Blob) => {
      createdObjects.push(blob);
      return 'mock-blob-url';
    }) as any;
    global.URL.revokeObjectURL = jest.fn((url: string) => {
      revokedUrl = url;
    }) as any;
    global.document.createElement = jest.fn((tag: string) => {
      if (tag === 'a') return mockAnchor;
      return originalCreateElement.call(global.document, tag);
    }) as any;

    await renderDataCenter();
    fireEvent.click(screen.getByText('导出报表'));

    expect(createdObjects.length).toBe(1);
    expect(createdObjects[0].type).toContain('text/csv');
    expect((mockAnchor as any).click).toHaveBeenCalled();
    expect(revokedUrl).toBe('mock-blob-url');

    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    global.document.createElement = originalCreateElement;
  });
});
