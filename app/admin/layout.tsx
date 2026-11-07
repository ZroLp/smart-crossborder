'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'

const adminNavItems = [
  { icon: '📊', label: '运营总览', href: '/admin' },
  { icon: '👥', label: '用户管理', href: '/admin/users' },
  { icon: '🏪', label: '店铺管理', href: '/admin/shops' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (user.role !== 'admin') {
      router.replace('/dashboard/403')
    }
  }, [user, loading, router])

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[#4E5969]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-[240px] h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0">
        <div className="h-[60px] flex items-center px-6 border-b border-gray-100">
          <span className="text-xl font-bold text-primary">跨境智卖 · 管理后台</span>
        </div>
        <nav className="flex-1 py-4">
          {adminNavItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-gray-500 dark:text-[#A0A4AC] hover:bg-gray-50 dark:hover:bg-[#22252D] border-l-4 border-transparent'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="ml-[240px] flex-1 flex flex-col">
        <header className="h-[60px] bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#1D2129]">管理后台</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-primary transition-colors"
            >
              返回卖家工作台
            </Link>
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-medium">
              {user.username?.slice(0, 1).toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 bg-[#F5F7FA] p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
