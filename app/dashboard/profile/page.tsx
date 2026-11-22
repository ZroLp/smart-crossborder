'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'

interface ProfileUser {
  id: number
  username: string
  email: string | null
  role: string
  created_at?: string
  updated_at?: string
}

interface ProfileSession {
  id: number | string
  device?: string
  ip?: string
  current?: boolean
  createdAt?: string
  expiresAt?: string
}

interface ProfileData {
  user: ProfileUser | null
  sessions: ProfileSession[]
}

function asText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('zh-CN')
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#2A2D35] last:border-b-0">
      <div>
        <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">{label}</span>
        <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{value}</span>
      </div>
    </div>
  )
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmDisabled = false,
  confirmText,
  closeDisabled = false,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  onConfirm?: () => void
  confirmDisabled?: boolean
  confirmText?: string
  closeDisabled?: boolean
}) {
  const { t } = useTranslation()
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={closeDisabled ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-[#181A20] rounded-xl shadow-xl w-full max-w-md p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">{title}</h3>
        {children}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={closeDisabled}
            className="bg-gray-100 dark:bg-[#2A2D35] text-[#1D2129] dark:text-[#E8EAED] px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmText ?? t('common.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const notSet = t('common.notSet')
  const [data, setData] = useState<ProfileData>({ user: null, sessions: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/profile', { credentials: 'same-origin' })
      const body = await res.json()
      if (res.ok === false || body.success === false) {
        setLoadError(body.error || t('profile.loadFailed'))
        setData({ user: null, sessions: [] })
        return
      }
      setData({
        user: body.data?.user ?? null,
        sessions: Array.isArray(body.data?.sessions) ? body.data.sessions : [],
      })
    } catch {
      setLoadError(t('profile.loadFailedNetwork'))
      setData({ user: null, sessions: [] })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadProfile()
  }, [loadProfile, reloadToken])

  const closePasswordModal = () => {
    if (passwordSubmitting) return
    setShowPasswordModal(false)
    setPasswordError('')
    setPasswordForm({ current: '', new: '', confirm: '' })
  }

  const handleChangePassword = async () => {
    if (passwordSubmitting) return
    setPasswordError('')
    setPasswordSuccess(false)

    const { current, new: newPassword, confirm } = passwordForm

    if (!current || !newPassword || !confirm) {
      setPasswordError(t('profile.passwordEmpty'))
      return
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError(t('profile.lengthInvalid'))
      return
    }
    if (newPassword !== confirm) {
      setPasswordError(t('profile.mismatch'))
      return
    }
    if (newPassword === current) {
      setPasswordError(t('auth.sameAsCurrent'))
      return
    }

    setPasswordSubmitting(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: current,
          newPassword,
        }),
      })

      let body: { success?: boolean; code?: string; error?: string } = {}
      try {
        body = await res.json()
      } catch {
        body = {}
      }

      if (res.ok && body.success) {
        setPasswordSubmitting(false)
        setShowPasswordModal(false)
        setPasswordForm({ current: '', new: '', confirm: '' })
        setPasswordError('')
        setPasswordSuccess(true)
        return
      }

      if (res.status === 429 || body.code === 'RATE_LIMITED') {
        const retryAfter = res.headers.get('Retry-After')
        setPasswordError(
          retryAfter
            ? `${t('profile.rateLimitedPrefix')}${retryAfter}${t('profile.rateLimitedSuffix')}`
            : t('profile.rateLimited')
        )
      } else if (body.code === 'WEAK_PASSWORD') {
        setPasswordError(t('auth.weakPassword'))
      } else if (body.code === 'INVALID_CREDENTIALS') {
        setPasswordError(t('profile.wrongPassword'))
      } else if (body.code === 'SAME_PASSWORD') {
        setPasswordError(t('auth.sameAsCurrent'))
      } else if (res.status === 401) {
        setPasswordError(t('profile.sessionExpired'))
      } else {
        setPasswordError(body.error || t('profile.changeFailed'))
      }
    } catch {
      setPasswordError(t('profile.networkRetry'))
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const openPasswordModal = () => {
    setPasswordError('')
    setPasswordForm({ current: '', new: '', confirm: '' })
    setShowPasswordModal(true)
  }

  const roleMap: Record<string, string> = {
    admin: t('settings.admin'),
    operator: t('profile.operator'),
    viewer: t('profile.viewer'),
  }

  const user = data.user
  const roleLabel = user ? roleMap[user.role] || asText(user.role, notSet) : notSet

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
        <div className="h-40 bg-gray-100 dark:bg-[#22252D] rounded-xl"></div>
        <div className="h-64 bg-gray-100 dark:bg-[#22252D] rounded-xl"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('profile.title')}</h2>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#181A20] rounded-xl shadow-sm">
          <span className="text-4xl mb-4">👤</span>
          <p className="text-base text-[#4E5969] dark:text-[#A0A4AC]">
            {loadError || t('profile.noProfile')}
          </p>
          <button
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="mt-4 text-primary text-sm hover:underline"
          >
            {t('common.reload')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('profile.title')}</h2>

      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{loadError}</p>
          <button
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            {t('common.reload')}
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-4xl">
            👤
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">
              {asText(user.username, notSet)}
            </h3>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1">{notSet}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <InfoItem label={t('profile.nickname')} value={asText(user.username, notSet)} />
            <InfoItem label={t('profile.email')} value={asText(user.email, notSet)} />
            <InfoItem label={t('profile.phone')} value={notSet} />
          </div>
          <div>
            <InfoItem label={t('profile.role')} value={roleLabel} />
            <InfoItem label={t('profile.joinedDate')} value={formatDateTime(user.created_at)} />
            <InfoItem label={t('profile.bio')} value={notSet} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🔐 {t('profile.accountSecurity')}</h3>

        {passwordSuccess && (
          <div
            role="status"
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success/10 px-4 py-3"
          >
            <p className="text-sm text-success">{t('profile.passwordChanged')}</p>
            <button
              onClick={() => setPasswordSuccess(false)}
              className="text-success/70 hover:text-success text-lg leading-none"
              aria-label={t('common.closeError')}
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('profile.loginPassword')}</p>
                <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">
                  {t('profile.loginPasswordDesc')}
                </p>
              </div>
              <button
                onClick={openPasswordModal}
                className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90"
              >
                {t('settings.changePassword')}
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('profile.deviceManagement')}</p>
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">
              {t('profile.loggedInDevices')}: {data.sessions.length}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('profile.securityLevel')}</p>
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">{t('profile.noSecurityData')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📝 {t('profile.loginRecords')}</h3>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4 text-center">{t('profile.noLoginRecords')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] border-b border-gray-100 dark:border-[#2A2D35]">
                  <th className="py-3 pr-4 font-normal">{t('profile.colDevice')}</th>
                  <th className="py-3 pr-4 font-normal">{t('profile.colIp')}</th>
                  <th className="py-3 pr-4 font-normal">{t('profile.colLoginTime')}</th>
                  <th className="py-3 pr-4 font-normal">{t('profile.colExpiry')}</th>
                  <th className="py-3 font-normal">{t('profile.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr
                    key={String(session.id)}
                    className="border-b border-gray-100 dark:border-[#2A2D35] last:border-b-0"
                  >
                    <td className="py-3 pr-4 text-[#1D2129] dark:text-[#E8EAED]">
                      {asText(session.device, notSet)}
                    </td>
                    <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC] font-mono">
                      {asText(session.ip, notSet)}
                    </td>
                    <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC]">
                      {formatDateTime(session.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC]">
                      {formatDateTime(session.expiresAt)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          session.current
                            ? 'bg-success/10 text-success'
                            : 'bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC]'
                        }`}
                      >
                        {session.current ? t('profile.currentSession') : t('profile.activeSession')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showPasswordModal}
        onClose={closePasswordModal}
        title={t('settings.changePassword')}
        onConfirm={handleChangePassword}
        confirmDisabled={passwordSubmitting}
        confirmText={passwordSubmitting ? t('profile.submitting') : t('common.confirm')}
        closeDisabled={passwordSubmitting}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">{t('settings.currentPassword')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={passwordForm.current}
              disabled={passwordSubmitting}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
              placeholder={t('profile.currentPasswordPlaceholder')}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">{t('settings.newPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.new}
              disabled={passwordSubmitting}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, new: e.target.value }))}
              placeholder={t('profile.passwordLengthPlaceholder')}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED] disabled:opacity-60"
            />
            <p className="text-xs text-[#86909C] mt-1">{t('profile.passwordHint')}</p>
          </div>
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">{t('settings.confirmPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirm}
              disabled={passwordSubmitting}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
              placeholder={t('profile.confirmPlaceholder')}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED] disabled:opacity-60"
            />
          </div>

          {passwordError && (
            <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2">
              <p className="text-xs text-danger">{passwordError}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
