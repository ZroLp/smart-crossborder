'use client'

import { useTranslation } from '@/lib/i18n/use-translation'

interface AgentStatusCardProps {
  name: string
  type: string
  status: 'online' | 'busy' | 'offline'
  taskCount: number
}

const statusConfig = {
  online: { color: 'bg-success', labelKey: 'status.online' },
  busy: { color: 'bg-warning', labelKey: 'status.busy' },
  offline: { color: 'bg-gray-400', labelKey: 'status.offline' },
}

export default function AgentStatusCard({ name, type, status, taskCount }: AgentStatusCardProps) {
  const { t } = useTranslation()
  const cfg = statusConfig[status]

  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{name}</span>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{type}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.color}`}></span>
          <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t(cfg.labelKey)}</span>
        </div>
        <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('common.task')} <span className="font-semibold text-[#1D2129] dark:text-[#E8EAED]">{taskCount}</span></span>
      </div>
    </div>
  )
}
