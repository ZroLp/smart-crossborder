﻿'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/use-translation'
import AIBadge from './AIBadge'

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const navItems = [
    { icon: '📊', label: t('nav.dashboard'), href: '/dashboard', ai: false },
    { icon: '🔍', label: t('nav.selection'), href: '/dashboard/selection', ai: true },
    { icon: '🏪', label: t('nav.storeBuilder'), href: '/dashboard/store-builder', ai: true },
    { icon: '✍️', label: t('nav.content'), href: '/dashboard/content', ai: true },
    { icon: '📢', label: t('nav.adOptimizer'), href: '/dashboard/ad-optimizer', ai: true },
    { icon: '💬', label: t('nav.customerService'), href: '/dashboard/customer-service', ai: true },
    { icon: '📦', label: t('nav.fulfillment'), href: '/dashboard/fulfillment', ai: true },
    { icon: '📈', label: t('nav.dataCenter'), href: '/dashboard/data-center', ai: false },
    { icon: '🛡️', label: t('nav.compliance'), href: '/dashboard/compliance', ai: false },
    { icon: '📋', label: t('nav.taskLogs'), href: '/dashboard/task-logs', ai: false },
    { icon: '👤', label: t('nav.profile'), href: '/dashboard/profile', ai: false },
    { icon: '⚙️', label: t('nav.settings'), href: '/dashboard/settings', ai: false },
  ]

  return (
    <aside className="w-[240px] h-screen bg-white dark:bg-[#181A20] border-r border-gray-100 dark:border-[#2A2D35] flex flex-col fixed left-0 top-0">
      <div className="h-[60px] flex items-center px-6 border-b border-gray-100 dark:border-[#2A2D35]">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="跨境智卖" width={32} height={32} priority />
          <span className="text-lg font-bold text-primary">跨境智卖</span>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary border-l-4 border-primary'
                  : 'text-gray-500 hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              <span className="text-lg w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.ai && <AIBadge />}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
