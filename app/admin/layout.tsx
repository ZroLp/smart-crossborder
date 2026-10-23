﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const adminNavItems = [
  { icon: '📊', label: '运营总览', href: '/admin' },
  { icon: '👥', label: '用户管理', href: '/admin/users' },
  { icon: '🏪', label: '店铺管理', href: '/admin/shops' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkPermission() {
      const userId = sessionStorage.getItem('userId')
      const storedRole = sessionStorage.getItem('userRole')

      if (!userId) {
        router.replace('/login')
        return
      }

      if (storedRole === 'admin') {
        setAuthorized(true)
        setChecked(true)
        return
      }

      try {
        const res = await fetch(`/api/auth?userId=${userId}`)
        const data = await res.json()
        if (data.success && data.role === 'admin') {
          sessionStorage.setItem('userRole', data.role)
          setAuthorized(true)
        }
      } catch {
        setAuthorized(false)
      }
      setChecked(true)
    }

    checkPermission()
  }, [router])

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-[#4E5969]">加载中...</div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] dark:bg-[#0F1117]">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">无权访问</h1>
          <p className="text-[#4E5969] dark:text-[#A0A4AC] mb-6">仅管理员可访问此后台</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            返回卖家工作台
          </button>
        </div>
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
              A
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
