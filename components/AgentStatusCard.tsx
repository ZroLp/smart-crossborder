'use client'

interface AgentStatusCardProps {
  name: string
  type: string
  status: 'online' | 'busy' | 'offline'
  taskCount: number
}

const statusConfig = {
  online: { color: 'bg-success', label: '在线' },
  busy: { color: 'bg-warning', label: '忙碌' },
  offline: { color: 'bg-gray-400', label: '离线' },
}

export default function AgentStatusCard({ name, type, status, taskCount }: AgentStatusCardProps) {
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
          <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{cfg.label}</span>
        </div>
        <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">任务 <span className="font-semibold text-[#1D2129] dark:text-[#E8EAED]">{taskCount}</span></span>
      </div>
    </div>
  )
}
