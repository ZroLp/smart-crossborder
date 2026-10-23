/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataCenterPage from '@/app/dashboard/data-center/page';

describe('DataCenterPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-05-30'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders page title and controls', () => {
    render(<DataCenterPage />);
    expect(screen.getByText('数据中心')).toBeInTheDocument();
    expect(screen.getByText('导出报表')).toBeInTheDocument();
  });

  test('renders 4 stat cards', () => {
    render(<DataCenterPage />);
    expect(screen.getByText('总营收')).toBeInTheDocument();
    expect(screen.getByText('总订单')).toBeInTheDocument();
    expect(screen.getByText('客单价')).toBeInTheDocument();
    expect(screen.getByText('转化率')).toBeInTheDocument();
  });

  test('renders chart sections', () => {
    render(<DataCenterPage />);
    expect(screen.getByText('📈 营收趋势')).toBeInTheDocument();
    expect(screen.getByText('📦 订单趋势')).toBeInTheDocument();
    expect(screen.getByText('🌐 流量来源')).toBeInTheDocument();
    expect(screen.getByText('🏆 商品排行')).toBeInTheDocument();
  });

  test('date range select has correct options', () => {
    render(<DataCenterPage />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('7d');
    expect(screen.getByText('近7天')).toBeInTheDocument();
    expect(screen.getByText('近30天')).toBeInTheDocument();
    expect(screen.getByText('近90天')).toBeInTheDocument();
    expect(screen.getByText('自定义')).toBeInTheDocument();
  });

  test('date range change triggers data refresh', () => {
    render(<DataCenterPage />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '30d' } });
    expect(select).toHaveValue('30d');
  });

  test('export button creates blob and triggers download', () => {
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

    render(<DataCenterPage />);
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
