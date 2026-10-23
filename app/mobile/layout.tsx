'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useOnlineStatus } from '@/hooks/use-online-status'
import OfflineIndicator from '@/components/OfflineIndicator'
import { OfflineContext } from '@/lib/offline-context'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const isLoginPage = pathname === '/mobile/login'
  const { isOnline, wasOffline, acknowledgeReconnect } = useOnlineStatus()

  const tabs = [
    { name: t('mobile.home'), path: '/mobile', icon: '🏠' },
    { name: t('mobile.dashboard'), path: '/mobile/dashboard', icon: '📊' },
    { name: t('mobile.command'), path: '/mobile/command', icon: '💬' },
    { name: t('mobile.messages'), path: '/mobile/messages', icon: '📋' },
    { name: t('mobile.profile'), path: '/mobile/profile', icon: '👤' },
  ]

  return (
    <OfflineContext.Provider value={{ isOnline, wasOffline, acknowledgeReconnect }}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#22252D] flex justify-center">
        <div className="w-full max-w-[480px] relative">
          <OfflineIndicator isOnline={isOnline} />
          <main className={isLoginPage ? '' : 'pb-20'}>
            {children}
          </main>
          {!isLoginPage && (
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white dark:bg-[#181A20] border-t border-gray-100 dark:border-[#2A2D35] flex items-center justify-around h-16 z-50">
              {tabs.map((tab) => {
                const isActive = pathname === tab.path
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                      isActive ? 'text-primary' : 'text-gray-400 dark:text-[#6B7080]'
                    }`}
                  >
                    <span className="text-xl mb-0.5">{tab.icon}</span>
                    <span className="text-[10px] font-medium">{tab.name}</span>
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </div>
    </OfflineContext.Provider>
  )
}
