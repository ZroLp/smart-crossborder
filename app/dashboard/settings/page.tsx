﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/lib/i18n/locale-context'
import { useTheme, Theme } from '@/lib/theme/theme-context'
import { useTranslation } from '@/lib/i18n/use-translation'
import { Locale, LOCALES, CURRENCIES } from '@/lib/i18n/index'

const TIMEZONE_OPTIONS = [
  'Asia/Shanghai',
  'America/New_York',
  'Europe/London',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'America/Los_Angeles',
]

const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
}

interface Shop {
  id: number
  user_id: number
  shop_name: string
  domain: string
  access_token: string
  scope: string
  status: string
  created_at: string
  updated_at: string
}

interface AIConfig {
  apiKeyConfigured: boolean
  modelName: string
  provider: string
}

export default function SettingsPage() {
  const { locale, setLocale, timezone, setTimezone, currency, setCurrency } = useLocale()
  const { theme, setTheme, isDark } = useTheme()
  const { t } = useTranslation()
  const [userId, setUserId] = useState<number | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [emailNotif, setEmailNotif] = useState(true)
  const [pushNotif, setPushNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [userRole, setUserRole] = useState<string>('viewer')
  const [allUsers, setAllUsers] = useState<{ id: number; username: string; role: string }[]>([])
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; key: string; env: string; createdAt: string; lastUsed: string; isActive: boolean }[]>([
    { id: 'pk_live_abc123', name: '生产环境密钥', key: 'pk_live_abc123def456ghi789', env: 'production', createdAt: '2025-03-15', lastUsed: '2小时前', isActive: true },
    { id: 'pk_test_xyz789', name: '测试环境密钥', key: 'pk_test_xyz789abc123def456', env: 'test', createdAt: '2025-04-01', lastUsed: '3天前', isActive: true },
    { id: 'sk_sync_old456', name: '数据同步密钥', key: 'sk_sync_old456mno123pqr789', env: 'sync', createdAt: '2025-01-10', lastUsed: '1周前', isActive: false },
  ])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyEnv, setNewKeyEnv] = useState('production')
  const [newlyCreatedKey, setNewlyCreatedKey] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    const uid = sessionStorage.getItem('userId')
    if (uid) {
      const userIdNum = parseInt(uid, 10)
      setUserId(userIdNum)
      fetch(`/api/auth?userId=${userIdNum}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUserRole(data.role)
            if (data.user) {
              setUsername(data.user.username || '')
              setEmail(data.user.email || '')
            }
          }
        })
    }
  }, [])

  useEffect(() => {
    if (userId) {
      fetch('/api/config/ai')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAiConfig(data.data)
          }
        })
    }
  }, [userId])

  useEffect(() => {
    if (userId) {
      setShopsLoading(true)
      fetch(`/api/shop?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setShops(data.data)
          }
        })
        .finally(() => setShopsLoading(false))
    }
  }, [userId])

  useEffect(() => {
    if (userRole === 'admin') {
      fetch('/api/users/all')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAllUsers(data.users)
          }
        })
        .catch(() => {})
    }
  }, [userRole])

  useEffect(() => {
    if (userId) {
      fetch(`/api/user-preferences?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const prefs = data.data
            if (typeof prefs.emailNotif === 'boolean') setEmailNotif(prefs.emailNotif)
            if (typeof prefs.pushNotif === 'boolean') setPushNotif(prefs.pushNotif)
            if (typeof prefs.smsNotif === 'boolean') setSmsNotif(prefs.smsNotif)
          }
        })
        .catch(() => {})
    }
  }, [userId])

  const saveNotificationPrefs = (email: boolean, push: boolean, sms: boolean) => {
    if (!userId) return
    fetch('/api/user-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        emailNotif: email,
        pushNotif: push,
        smsNotif: sms,
      }),
    }).catch(() => {})
  }

  const handlePasswordChange = () => {
    if (!userId || !currentPassword || !newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) {
      setPasswordMessage(t('auth.passwordsDoNotMatch'))
      return
    }
    fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPasswordMessage(t('settings.passwordChanged'))
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        } else {
          setPasswordMessage(
            data.error === 'Current password is incorrect'
              ? t('settings.currentPasswordIncorrect')
              : t('settings.passwordChangeFailed')
          )
        }
      })
      .catch(() => {
        setPasswordMessage(t('settings.passwordChangeFailed'))
      })
  }

  const handleUnbindShop = (shopId: number) => {
    fetch(`/api/shop?shopId=${shopId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setShops(prev => prev.filter(s => s.id !== shopId))
        }
      })
  }

  const handleRoleChange = (userId: number, newRole: string) => {
    fetch('/api/users/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
        }
      })
      .catch(() => {})
  }

  const getCurrencySymbol = (c: string) => {
    switch (c) {
      case 'USD': return '$'
      case 'EUR': return '€'
      case 'GBP': return '£'
      default: return '¥'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return t('settings.admin')
      case 'operator': return t('settings.operator')
      default: return t('settings.viewer')
    }
  }

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700'
      case 'operator': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 dark:bg-[#22252D] text-gray-700'
    }
  }

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  const generateApiKey = (prefix: string) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = prefix
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return key
  }

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) return
    const prefix = newKeyEnv === 'production' ? 'pk_live_' : newKeyEnv === 'test' ? 'pk_test_' : 'sk_sync_'
    const newKey = generateApiKey(prefix)
    const apiKeyEntry = {
      id: newKey.substring(0, 16),
      name: newKeyName.trim(),
      key: newKey,
      env: newKeyEnv,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: '从未使用',
      isActive: true,
    }
    setApiKeys(prev => [...prev, apiKeyEntry])
    setNewlyCreatedKey(newKey)
    setShowCreateModal(false)
    setNewKeyName('')
  }

  const handleToggleApiKey = (id: string) => {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: !k.isActive } : k))
  }

  const handleDeleteApiKey = (id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id))
  }

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key
    return key.substring(0, 8) + '••••••••' + key.substring(key.length - 6)
  }

  const getEnvLabel = (env: string) => {
    switch (env) {
      case 'production': return '生产环境'
      case 'test': return '测试环境'
      case 'sync': return '数据同步'
      default: return env
    }
  }

  const getEnvBadgeStyle = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
      case 'test': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
      case 'sync': return 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
      default: return 'bg-gray-100 dark:bg-[#22252D] text-gray-700'
    }
  }

  const plans = [
    {
      name: t('settings.basicPlan'),
      price: '¥99' + t('settings.perMonth'),
      features: ['3' + t('settings.stores'), t('settings.basicAI'), t('settings.dataBoard')],
      current: false,
    },
    {
      name: t('settings.proPlan'),
      price: '¥299' + t('settings.perMonth'),
      features: ['10' + t('settings.stores'), t('settings.fullAI'), t('settings.advancedData'), t('settings.apiAccess')],
      current: true,
    },
    {
      name: t('settings.enterprisePlan'),
      price: '¥899' + t('settings.perMonth'),
      features: [t('settings.unlimitedStores'), t('settings.fullAI'), t('settings.dedicatedService'), t('settings.customDev'), t('settings.slaGuarantee')],
      current: false,
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('settings.title')}</h2>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🤖 {t('settings.aiServiceConfig')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.openaiApiKeyStatus')}</p>
            <p className="mt-1 text-sm font-medium">
              {aiConfig
                ? (aiConfig.apiKeyConfigured
                  ? <span className="text-success">✓ {t('settings.openaiApiKeyConfigured')}</span>
                  : <span className="text-danger">✗ {t('settings.openaiApiKeyNotConfigured')}</span>)
                : <span className="text-[#86909C]">{t('common.loading')}...</span>}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.aiModel')}</p>
            <p className="mt-1 text-sm font-medium font-mono">{aiConfig?.modelName || '-'}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.aiProvider')}</p>
            <p className="mt-1 text-sm font-medium">{aiConfig?.provider || '-'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">🏪 {t('settings.shopifyStores')}</h3>
          {userId && (
            <a href={`/api/auth/shopify?userId=${userId}`} className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              {t('settings.addShop')}
            </a>
          )}
        </div>
        {shopsLoading ? (
          <p className="text-sm text-[#86909C]">{t('common.loading')}...</p>
        ) : shops.length === 0 ? (
          <p className="text-sm text-[#86909C]">{t('common.noData')}</p>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => (
              <div key={shop.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{shop.shop_name}</p>
                  <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] font-mono mt-0.5">{shop.domain}</p>
                  <p className="text-caption text-gray-400 mt-0.5">
                    {t('settings.bindingTime')}: {formatDate(shop.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      shop.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-[#22252D] text-gray-500'
                    }`}
                  >
                    {shop.status === 'active' ? t('settings.active') : t('settings.inactive')}
                  </span>
                  <button
                    onClick={() => handleUnbindShop(shop.id)}
                    className="text-xs text-danger hover:underline"
                  >
                    {t('settings.unbind')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">👤 {t('settings.accountManagement')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.role')}：</label>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${getRoleBadgeStyle(userRole)}`}>
            {getRoleLabel(userRole)}
          </span>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2A2D35]">
          <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3">{t('settings.changePassword')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.currentPassword')}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('settings.enterCurrentPassword')}
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.enterNewPassword')}
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.confirmPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.enterConfirmPassword')}
                className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          {passwordMessage && (
            <p className={`mt-2 text-sm ${passwordMessage.includes('成功') || passwordMessage.includes('successfully') ? 'text-success' : 'text-danger'}`}>
              {passwordMessage}
            </p>
          )}
          <button
            onClick={handlePasswordChange}
            className="mt-4 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('common.saveChanges')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📦 {t('settings.subscription')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`border rounded-xl p-5 relative ${plan.current ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-[#2A2D35]'}`}
            >
              {plan.current && (
                <span className="absolute top-3 right-3 text-xs bg-primary text-white px-2 py-0.5 rounded-full">{t('common.current')}</span>
              )}
              <p className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{plan.name}</p>
              <p className="text-h1 text-primary mt-2">{plan.price}</p>
              <ul className="mt-3 space-y-2">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="text-sm text-[#4E5969] dark:text-[#A0A4AC] flex items-center gap-2">
                    <span className="text-success text-xs">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (plan.current) return
                  fetch('/api/subscription/upgrade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: plan.name }),
                  }).then(res => res.json()).then(data => {
                    if (data.success) {
                      window.location.reload()
                    }
                  }).catch(() => {})
                }}
                className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  plan.current
                    ? 'bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] cursor-default'
                    : 'bg-primary text-white hover:opacity-90'
                }`}
                disabled={plan.current}
              >
                {plan.current ? t('common.currentPlan') : t('common.upgradePlan')}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.aiUsageThisMonth')}</span>
            <span className="text-[#1D2129] dark:text-[#E8EAED] font-medium">3,247 / 10,000</span>
          </div>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-[#1E2028] rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: '32.5%' }} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🔔 {t('settings.notifications')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('settings.emailNotification')}</p>
              <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.emailNotificationDesc')}</p>
            </div>
            <button
              onClick={() => { const newVal = !emailNotif; setEmailNotif(newVal); saveNotificationPrefs(newVal, pushNotif, smsNotif) }}
              className={`relative w-11 h-6 rounded-full transition-colors ${emailNotif ? 'bg-primary' : 'bg-gray-200 dark:bg-[#2A2D35]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailNotif ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('settings.pushNotification')}</p>
              <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.pushNotificationDesc')}</p>
            </div>
            <button
              onClick={() => { const newVal = !pushNotif; setPushNotif(newVal); saveNotificationPrefs(emailNotif, newVal, smsNotif) }}
              className={`relative w-11 h-6 rounded-full transition-colors ${pushNotif ? 'bg-primary' : 'bg-gray-200 dark:bg-[#2A2D35]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushNotif ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{t('settings.smsNotification')}</p>
              <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.smsNotificationDesc')}</p>
            </div>
            <button
              onClick={() => { const newVal = !smsNotif; setSmsNotif(newVal); saveNotificationPrefs(emailNotif, pushNotif, newVal) }}
              className={`relative w-11 h-6 rounded-full transition-colors ${smsNotif ? 'bg-primary' : 'bg-gray-200 dark:bg-[#2A2D35]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${smsNotif ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🌐 {t('settings.intlSettings')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.language')}</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.timezone')}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('settings.currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c} ({getCurrencySymbol(c)})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🎨 {t('settings.themeSettings')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { value: 'light' as Theme, label: t('theme.lightMode'), icon: '☀️', border: 'border-gray-200 dark:border-[#2A2D35]', bg: 'bg-white dark:bg-[#181A20]' },
            { value: 'dark' as Theme, label: t('theme.darkMode'), icon: '🌙', border: 'border-gray-700', bg: 'bg-gray-800' },
            { value: 'system' as Theme, label: t('theme.followSystem'), icon: '💻', border: 'border-gray-300', bg: 'bg-gray-100 dark:bg-[#22252D]' },
          ]).map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
                theme === option.value
                  ? 'border-primary bg-primary/5'
                  : `${option.border} ${option.bg} hover:border-primary/40`
              }`}
            >
              <span className="text-3xl">{option.icon}</span>
              <span className={`text-sm font-medium ${theme === option.value ? 'text-primary' : 'text-[#1D2129] dark:text-[#E8EAED]'}`}>
                {option.label}
              </span>
              {theme === option.value && (
                <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">
            当前主题：{theme === 'system' ? (isDark ? t('theme.darkMode') : t('theme.lightMode')) : (theme === 'light' ? t('theme.lightMode') : t('theme.darkMode'))}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">🔑 {t('settings.apiKeys')}</h3>
          <button
            onClick={() => { setShowCreateModal(true); setNewlyCreatedKey('') }}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('common.createNewKey')}
          </button>
        </div>
        <div className="space-y-3">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-4 rounded-lg border border-gray-100 dark:border-[#2A2D35] bg-gray-50 dark:bg-[#22252D]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{apiKey.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getEnvBadgeStyle(apiKey.env)}`}>{getEnvLabel(apiKey.env)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${apiKey.isActive ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-[#2A2D35] text-gray-500'}`}>
                      {apiKey.isActive ? '已激活' : '已停用'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-[#4E5969] dark:text-[#A0A4AC] bg-white dark:bg-[#181A20] px-2 py-1 rounded">
                      {showApiKey ? apiKey.key : maskApiKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-xs text-primary hover:underline"
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                    <button
                      onClick={() => handleCopyApiKey(apiKey.key)}
                      className="text-xs text-primary hover:underline"
                    >
                      {copiedKey === apiKey.key ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#86909C]">
                    <span>{t('common.created')}: {apiKey.createdAt}</span>
                    <span>{t('common.lastUsed')}: {apiKey.lastUsed}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleApiKey(apiKey.id)}
                    className={`text-xs px-3 py-1 rounded-lg transition-colors ${apiKey.isActive ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-success/10 text-success hover:bg-success/20'}`}
                  >
                    {apiKey.isActive ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleDeleteApiKey(apiKey.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { if (!newlyCreatedKey) setShowCreateModal(false) }}>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            {!newlyCreatedKey ? (
              <>
                <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">创建新 API 密钥</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-1 block">密钥名称</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="例如：我的生产密钥"
                      className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#22252D] dark:text-[#E8EAED]"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-1 block">环境类型</label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value)}
                      className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#22252D] dark:text-[#E8EAED]"
                    >
                      <option value="production">生产环境</option>
                      <option value="test">测试环境</option>
                      <option value="sync">数据同步</option>
                    </select>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-[#4E5969] dark:text-[#A0A4AC] hover:bg-gray-100 dark:hover:bg-[#22252D] transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleCreateApiKey}
                      disabled={!newKeyName.trim()}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('common.create')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">密钥创建成功！</h3>
                <p className="text-sm text-warning mb-4">请立即复制并妥善保存此密钥，关闭后将无法再次查看完整密钥。</p>
                <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-3 mb-4">
                  <code className="text-xs font-mono text-[#1D2129] dark:text-[#E8EAED] break-all">{newlyCreatedKey}</code>
                </div>
                <button
                  onClick={() => handleCopyApiKey(newlyCreatedKey)}
                  className="w-full bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {copiedKey === newlyCreatedKey ? '已复制到剪贴板' : '复制密钥'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full mt-3 text-sm text-[#4E5969] dark:text-[#A0A4AC] hover:text-[#1D2129] dark:hover:text-[#E8EAED] transition-colors"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🛡️ {t('settings.userRoleManagement')}</h3>
          <div className="space-y-3">
            {allUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{user.username}</p>
                  <p className="text-xs text-[#86909C]">ID: {user.id}</p>
                </div>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="admin">{t('settings.admin')}</option>
                  <option value="operator">{t('settings.operator')}</option>
                  <option value="viewer">{t('settings.viewer')}</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
