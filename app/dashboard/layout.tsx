'use client'

import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'

const READ_ONLY_PAGES = new Set([
  '/dashboard',
  '/dashboard/selection',
  '/dashboard/content',
  '/dashboard/task-logs',
  '/dashboard/compliance',
])

function isPathAllowed(role: string, pathname: string): boolean {
  if (role === 'admin') {
    return true
  }

  const normalizedPath = pathname.split('?')[0].split('#')[0]

  if (role === 'viewer') {
    return READ_ONLY_PAGES.has(normalizedPath)
  }

  if (role === 'operator') {
    return normalizedPath !== '/dashboard/settings'
  }

  return true
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/login')
      return
    }

    setForbidden(!isPathAllowed(user.role, pathname))
  }, [user, loading, pathname, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[#4E5969] dark:text-[#A0A4AC]">加载中...</div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-semibold text-[#1D2129] mb-2">无权访问</h1>
          <p className="text-[#4E5969] mb-6">您的角色没有权限访问此页面</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="ml-[240px] flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 bg-[#F5F7FA] dark:bg-[#0F1117] p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
