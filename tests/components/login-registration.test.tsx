/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
const mockGet = jest.fn(() => null);

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

import LoginPage from '@/app/login/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue(null);
  global.fetch = jest.fn();
});

afterEach(() => {
  delete (global as any).fetch;
});

describe('LoginPage - Tabs', () => {
  test('renders login tab by default', () => {
    render(<LoginPage />);
    const loginButtons = screen.getAllByRole('button', { name: '登录' });
    expect(loginButtons.length).toBe(2);
    const registerButtons = screen.getAllByRole('button', { name: '注册' });
    expect(registerButtons.length).toBe(1);
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
  });

  test('renders both login and register tabs', () => {
    render(<LoginPage />);
    const loginButtons = screen.getAllByRole('button', { name: '登录' });
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    expect(loginButtons.length).toBe(2);
    expect(registerTab).toBeInTheDocument();
  });

  test('switching to register tab shows register form', () => {
    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请再次输入密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入邮箱')).toBeInTheDocument();
  });

  test('switching back to login tab shows login form', () => {
    render(<LoginPage />);

    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);
    expect(screen.getByPlaceholderText('请再次输入密码')).toBeInTheDocument();

    const loginTab = screen.getAllByRole('button', { name: '登录' })[0];
    fireEvent.click(loginTab);
    expect(screen.queryByPlaceholderText('请再次输入密码')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入邮箱')).not.toBeInTheDocument();
  });
});

describe('LoginPage - Register Validation', () => {
  test('validates required fields empty shows error', async () => {
    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名和密码')).toBeInTheDocument();
    });
  });

  test('validates password mismatch shows error', async () => {
    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), {
      target: { value: 'password456' },
    });

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
    });
  });

  test('validates only username filled shows error', async () => {
    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'testuser' },
    });

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名和密码')).toBeInTheDocument();
    });
  });
});

describe('LoginPage - Successful Registration', () => {
  test('calls API with register action and auto-login on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true, userId: 42 }),
    });

    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'secure123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), {
      target: { value: 'secure123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), {
      target: { value: 'test@example.com' },
    });

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: 'newuser',
          password: 'secure123',
          email: 'test@example.com',
        }),
      });
    });
  });

  test('shows username exists error on duplicate registration', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Username already exists' }),
    });

    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'existinguser' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), {
      target: { value: 'password123' },
    });

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('用户名已存在，请更换')).toBeInTheDocument();
    });
  });

  test('shows generic error on registration failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Some other error' }),
    });

    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('请再次输入密码'), {
      target: { value: 'password123' },
    });

    const submitButtons = screen.getAllByRole('button', { name: '注册' });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Some other error')).toBeInTheDocument();
    });
  });
});

describe('LoginPage - Enter key support', () => {
  test('login form triggers login on Enter in password field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Invalid credentials' }),
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'testuser' },
    });
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    fireEvent.change(passwordInput, {
      target: { value: 'wrongpassword' },
    });
    fireEvent.keyDown(passwordInput, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: 'testuser', password: 'wrongpassword' }),
      });
    });
  });

  test('register form triggers register on Enter in confirmPassword field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'Username already exists' }),
    });

    render(<LoginPage />);
    const registerTab = screen.getAllByRole('button', { name: '注册' })[0];
    fireEvent.click(registerTab);

    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'password123' },
    });
    const confirmPasswordInput = screen.getByPlaceholderText('请再次输入密码');
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'password123' },
    });
    fireEvent.keyDown(confirmPasswordInput, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: 'testuser',
          password: 'password123',
          email: null,
        }),
      });
    });
  });
});
