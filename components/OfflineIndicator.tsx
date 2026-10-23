'use client'

import { useState, useEffect } from 'react'
import { getAllData, type CacheEntry } from '@/lib/offline/cache-manager'

interface OfflineIndicatorProps {
  isOnline: boolean
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export default function OfflineIndicator({ isOnline }: OfflineIndicatorProps) {
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  useEffect(() => {
    if (isOnline) return

    async function fetchLastUpdate() {
      const stores = ['dashboard-data', 'tasks', 'messages'] as const
      let latest = 0

      for (const storeName of stores) {
        const entries: CacheEntry[] = await getAllData(storeName)
        for (const entry of entries) {
          if (entry.timestamp > latest) {
            latest = entry.timestamp
          }
        }
      }

      if (latest > 0) {
        setLastUpdate(latest)
      }
    }

    fetchLastUpdate()
  }, [isOnline])

  return (
    <div
      className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[60] transition-transform duration-300 ${
        isOnline ? '-translate-y-full' : 'translate-y-0'
      }`}
      style={{ backgroundColor: '#FF7D00' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">📡 离线模式</span>
        </div>
        {lastUpdate && (
          <span className="text-white/80 text-xs">
            最后更新: {formatTimestamp(lastUpdate)}
          </span>
        )}
      </div>
    </div>
  )
}
