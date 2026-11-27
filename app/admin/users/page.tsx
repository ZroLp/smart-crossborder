'use client'

import { useState, useEffect } from 'react'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useTranslation } from '@/lib/i18n/use-translation'

interface User {
  id: number
  username: string
  email: string
  role: string
  created_at: string
}

const ROLE_OPTIONS = ['all', 'admin', 'operator', 'viewer']

const ROLE_LABEL_KEYS: Record<string, string> = {
  all: 'common.all',
  admin: 'settings.admin',
  operator: 'admin.roleOperator',
  viewer: 'admin.roleViewer',
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  operator: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('all')
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setUsers(data.users)
          }
        }
      } catch {
        console.error('Failed to fetch users')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
          )
        }
      }
    } catch {
      console.error('Failed to update role')
    }
  }

  const filteredUsers = filterRole === 'all'
    ? users
    : users.filter((u) => u.role === filterRole)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED]">{t('admin.usersNav')}</h1>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-[#2A2D35] rounded-lg bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {t(ROLE_LABEL_KEYS[role])}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonLoader variant="text" width="120px" height="16px" />
              <SkeletonLoader variant="text" width="200px" height="16px" />
              <SkeletonLoader variant="text" width="80px" height="16px" />
              <SkeletonLoader variant="text" width="100px" height="16px" />
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">{t('admin.usersEmpty')}</h3>
          <p className="text-sm text-[#86909C] dark:text-[#6B7080]">
            {filterRole === 'all' ? t('admin.usersEmptyAll') : t('admin.usersEmptyRole')}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.usernameCol')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.emailCol')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.roleCol')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.registerDateCol')}</th>
                <th className="text-left text-xs font-medium text-[#86909C] dark:text-[#6B7080] px-6 py-3">{t('admin.actionsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 dark:hover:bg-[#22252D]/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-[#1D2129] dark:text-[#E8EAED] font-medium">{user.username}</td>
                  <td className="px-6 py-4 text-sm text-[#4E5969] dark:text-[#A0A4AC]">{user.email || '--'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.viewer}`}>
                      {ROLE_LABEL_KEYS[user.role] ? t(ROLE_LABEL_KEYS[user.role]) : user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#86909C] dark:text-[#6B7080]">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '--'}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 dark:border-[#2A2D35] rounded-md bg-white dark:bg-[#181A20] text-[#1D2129] dark:text-[#E8EAED] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="admin">{t('settings.admin')}</option>
                      <option value="operator">{t('admin.roleOperator')}</option>
                      <option value="viewer">{t('admin.roleViewer')}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
