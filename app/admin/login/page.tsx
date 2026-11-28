'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/use-translation'

function AdminLoginPageContent() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setError(t('login.enterUsernamePassword'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      })
      if (res.status === 429) {
        setError(t('settings.rateLimited'))
        return
      }
      const data = await res.json()
      if (data.success) {
        window.location.replace('/admin')
        return
      }
      setError(data.error || t('auth.loginFailed'))
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-purple">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Image src="/logo.svg" alt={t('common.brandName')} width={40} height={40} priority />
            <h1 className="text-2xl font-bold text-primary">{t('admin.adminLoginTitle')}</h1>
          </div>
          <p className="text-sm text-[#4E5969]">{t('admin.adminLoginHint')}</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969]">{t('settings.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder={t('login.usernamePlaceholder')}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969]">{t('login.passwordLabel')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder={t('login.passwordPlaceholder')}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-danger/5 border border-danger/20 rounded-lg p-3">
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('login.loggingIn') : t('auth.login')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return <AdminLoginPageContent />
}
