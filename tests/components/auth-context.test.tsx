/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '@/lib/auth/auth-context'

function Probe() {
  const { user, role, loading, refresh, logout } = useAuth()
  const label = loading ? 'loading' : user ? `${user.username}:${role}` : 'anon'
  return (
    <div>
      <span data-testid="state">{label}</span>
      <button onClick={() => void refresh()}>refresh</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  )
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fn = jest.fn(handler)
  ;(global as any).fetch = fn
  return fn
}

describe('AuthProvider', () => {
  test('loads the current session user from GET /api/auth', async () => {
    mockFetch(async () => ({
      status: 200,
      json: async () => ({
        success: true,
        role: 'admin',
        user: { id: 1, username: 'alice', email: 'alice@example.com', role: 'admin' },
      }),
    }))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('alice:admin')
    })
  })

  test('treats 401 as unauthenticated', async () => {
    mockFetch(async () => ({
      status: 401,
      json: async () => ({ success: false, code: 'UNAUTHORIZED' }),
    }))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anon')
    })
  })

  test('logout calls the logout endpoint and clears the user', async () => {
    const fetchMock = mockFetch(async (url) => {
      if (url === '/api/auth/logout') {
        return { status: 200, json: async () => ({ success: true }) }
      }
      return {
        status: 200,
        json: async () => ({
          success: true,
          role: 'viewer',
          user: { id: 2, username: 'bob', email: null, role: 'viewer' },
        }),
      }
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('bob:viewer')
    })

    fireEvent.click(screen.getByText('logout'))

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anon')
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
