'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useAuth } from '@/lib/auth/auth-context'

export default function MobileLoginPage() {
  const { t } = useTranslation()
  const { refresh } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !username.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, username: username.trim(), password }),
      })
      if (res.status === 429) {
        setError(t('common.rateLimited'))
        return
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : t('common.requestFailed'))
        return
      }
      // 登录/注册成功后刷新会话态再进入首页
      await refresh()
      router.replace('/mobile')
    } catch {
      setError(t('common.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#181A20]">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">{t('mobile.accLogin')}</h1>
        <p className="mb-5 text-sm text-gray-500 dark:text-[#8B91A0]">{t('mobile.loginPrompt')}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#8B91A0]">
              {t('mobile.usernameLabel')}
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary dark:border-[#2A2D35] dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#8B91A0]">
              {t('mobile.passwordLabel')}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary dark:border-[#2A2D35] dark:text-white"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('common.loading') : mode === 'login' ? t('mobile.loginBtn') : t('mobile.registerBtn')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'))
            setError(null)
          }}
          className="mt-3 w-full text-center text-xs text-gray-500 underline-offset-2 hover:underline dark:text-[#6B7080]"
        >
          {mode === 'login' ? t('mobile.registerBtn') : t('mobile.loginBtn')}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400 dark:text-[#6B7080]">{t('mobile.smsSoon')}</p>
    </div>
  )
}
