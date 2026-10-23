/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomerServicePage from '@/app/dashboard/customer-service/page';

const mockFetch = jest.fn();

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

afterAll(() => {
  (Element.prototype as any).scrollIntoView = undefined;
});

describe('CustomerServicePage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('renders page title and chat header', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('智能客服')).toBeInTheDocument();
      expect(screen.getByText('AI客服助手')).toBeInTheDocument();
    });
  });

  test('renders chat statistics panel', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('客服统计')).toBeInTheDocument();
      expect(screen.getByText('响应率')).toBeInTheDocument();
      expect(screen.getByText('平均响应时间')).toBeInTheDocument();
      expect(screen.getByText('今日会话')).toBeInTheDocument();
    });
  });

  test('renders knowledge base panel', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('知识库')).toBeInTheDocument();
    });
  });

  test('renders welcome message from assistant', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('您好！我是AI客服助手，有什么可以帮您的吗？')).toBeInTheDocument();
    });
  });

  test('renders input textarea and send button', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
      expect(textarea).toBeInTheDocument();
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
  });

  test('send button is disabled when input is empty', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeDisabled();
    });
  });

  test('send button is enabled when input has content', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
      fireEvent.change(textarea, { target: { value: '你好' } });
      expect(screen.getByText('发送')).not.toBeDisabled();
    });
  });

  test('clicking FAQ fills input and focuses textarea', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: [
          { question: '如何查询订单？', answer: '请在订单页面输入订单号查询' },
        ],
      }),
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('如何查询订单？')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('如何查询订单？'));
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    expect((textarea as HTMLTextAreaElement).value).toBe('如何查询订单？');
  });

  test('pressing Enter sends message', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { taskId: 'task-123', response: '你好' },
      }),
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '测试消息' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agent',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('pressing Shift+Enter does not send message', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { taskId: 'task-123', response: '你好' },
      }),
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '测试消息' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/agent',
      expect.anything()
    );
  });

  test('sends message and shows loading state', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return new Promise(() => {});
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      expect(screen.getByText('发送中')).toBeInTheDocument();
    });
  });

  test('displays user message in chat after sending', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: { taskId: 'task-123', response: '你好' },
        }),
      });
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '你好，请问有什么服务？' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      expect(screen.getByText('你好，请问有什么服务？')).toBeInTheDocument();
    });
  });

  test('displays assistant response in chat', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: { taskId: 'task-123', response: '您好！很高兴为您服务。' },
        }),
      });
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      expect(screen.getByText('您好！很高兴为您服务。')).toBeInTheDocument();
    });
  });

  test('clears input after sending', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: { taskId: 'task-123', response: '你好' },
        }),
      });
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '测试消息' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe('');
    });
  });

  test('shows loading skeleton when data is loading', async () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {})
    );
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('正在加载客服数据...')).toBeInTheDocument();
    });
  });

  test('handles API error gracefully', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.reject(new Error('Network error'));
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      expect(screen.getByText('抱歉，服务暂时不可用，请稍后再试。')).toBeInTheDocument();
    });
  });

  test('renders online status indicator', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('在线')).toBeInTheDocument();
    });
  });

  test('textarea auto-resizes on input', async () => {
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '这是一条很长的消息，用来测试多行输入框的自动调整高度功能是否正常' } });
    expect((textarea as HTMLTextAreaElement).style.height).not.toBe('auto');
  });

  test('renders typing indicator animation when sending', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return new Promise(() => {});
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
    const textarea = screen.getByPlaceholderText('输入消息... (Shift+Enter换行)');
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.click(screen.getByText('发送'));

    await waitFor(() => {
      const typingDots = document.querySelectorAll('.animate-bounce');
      expect(typingDots.length).toBe(3);
    });
  });

  test('displays default FAQs when API returns no data', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/data')) {
        return Promise.resolve({ json: () => Promise.resolve({ success: false }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    });
    render(<CustomerServicePage />);
    await waitFor(() => {
      expect(screen.getByText('如何查询订单？')).toBeInTheDocument();
      expect(screen.getByText('如何退换货？')).toBeInTheDocument();
    });
  });
});
