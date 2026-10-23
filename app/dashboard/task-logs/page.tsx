'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const agents = ['全部Agent', '选品Agent', '建站Agent', '内容Agent', '投流Agent', '客服Agent', '履约Agent']

const initialLogs = [
  { id: 'TSK-2025052301', agent: '选品Agent', name: '北美户外用品选品分析', status: 'completed', createdAt: '2025-05-23 08:12', duration: '3m 24s' },
  { id: 'TSK-2025052302', agent: '内容Agent', name: '智能手表多语言文案生成', status: 'completed', createdAt: '2025-05-23 08:35', duration: '1m 48s' },
  { id: 'TSK-2025052303', agent: '投流Agent', name: 'Facebook广告组自动优化', status: 'running', createdAt: '2025-05-23 09:01', duration: '进行中' },
  { id: 'TSK-2025052304', agent: '客服Agent', name: '德国站售后邮件自动回复', status: 'completed', createdAt: '2025-05-23 09:15', duration: '0m 42s' },
  { id: 'TSK-2025052305', agent: '履约Agent', name: '东南亚仓自动补货预警', status: 'failed', createdAt: '2025-05-23 09:30', duration: '2m 11s' },
  { id: 'TSK-2025052206', agent: '建站Agent', name: 'Shopify店铺主题自动更新', status: 'completed', createdAt: '2025-05-22 17:45', duration: '4m 05s' },
  { id: 'TSK-2025052207', agent: '选品Agent', name: '日本站美妆品类趋势扫描', status: 'completed', createdAt: '2025-05-22 16:20', duration: '5m 33s' },
  { id: 'TSK-2025052208', agent: '投流Agent', name: 'Google Shopping广告创建', status: 'failed', createdAt: '2025-05-22 15:10', duration: '1m 57s' },
  { id: 'TSK-2025052209', agent: '内容Agent', name: '蓝牙耳机产品视频脚本生成', status: 'completed', createdAt: '2025-05-22 14:30', duration: '2m 19s' },
  { id: 'TSK-2025052210', agent: '客服Agent', name: '法国站退货政策FAQ更新', status: 'completed', createdAt: '2025-05-22 11:50', duration: '0m 55s' },
  { id: 'TSK-2025052111', agent: '履约Agent', name: '英国仓库存同步与调拨', status: 'running', createdAt: '2025-05-21 10:05', duration: '进行中' },
  { id: 'TSK-2025052112', agent: '选品Agent', name: '欧洲家居品类竞品监控', status: 'completed', createdAt: '2025-05-21 09:20', duration: '6m 12s' },
]

export default function TaskLogsPage() {
  const router = useRouter()
  const [agentFilter, setAgentFilter] = useState('全部Agent')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [timeRange, setTimeRange] = useState('7d')
  const [logs, setLogs] = useState(initialLogs)

  const statusMap: Record<string, { label: string; color: string }> = {
    running: { label: '执行中', color: 'text-primary bg-primary/10' },
    completed: { label: '已完成', color: 'text-success bg-success/10' },
    failed: { label: '执行失败', color: 'text-danger bg-danger/10' },
  }

  const filteredLogs = logs.filter((log) => {
    if (agentFilter !== '全部Agent' && !log.agent.includes(agentFilter.replace('Agent', ''))) return false
    if (statusFilter === '执行中' && log.status !== 'running') return false
    if (statusFilter === '已完成' && log.status !== 'completed') return false
    if (statusFilter === '执行失败' && log.status !== 'failed') return false
    return true
  })

  const totalCount = logs.length
  const runningCount = logs.filter((l) => l.status === 'running').length
  const completedCount = logs.filter((l) => l.status === 'completed').length
  const failedCount = logs.filter((l) => l.status === 'failed').length

  const handleRetry = (id: string) => {
    setLogs((prev) =>
      prev.map((log) =>
        log.id === id ? { ...log, status: 'running' as const, duration: '进行中' } : log
      )
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">AI任务日志中心</h2>
        <button
          onClick={() => {
            const csv = '任务ID,Agent模块,任务名称,状态,创建时间,耗时\n' + 
              logs.map(l => `${l.id},${l.agent},${l.name},${l.status},${l.createdAt},${l.duration}`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `task-logs-${Date.now()}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          导出日志
        </button>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">Agent模块</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {agents.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">任务状态</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="全部">全部</option>
              <option value="执行中">执行中</option>
              <option value="已完成">已完成</option>
              <option value="执行失败">执行失败</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">时间范围</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="1d">今天</option>
              <option value="3d">近3天</option>
              <option value="7d">近7天</option>
              <option value="30d">近30天</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">总任务数</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">执行中</p>
          <p className="text-h1 text-primary mt-1">{runningCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">已完成</p>
          <p className="text-h1 text-success mt-1">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">执行失败</p>
          <p className="text-h1 text-danger mt-1">{failedCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">任务ID</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">Agent模块</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">任务名称</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">状态</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">创建时间</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">耗时</th>
                <th className="text-left px-6 py-3 text-caption text-[#4E5969] dark:text-[#A0A4AC] font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 dark:border-[#22252D] hover:bg-gray-50 dark:hover:bg-[#22252D] transition-colors">
                  <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">{log.id}</td>
                  <td className="px-6 py-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{log.agent}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-[#1D2129] dark:text-[#E8EAED]">{log.name}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMap[log.status].color}`}>
                      {statusMap[log.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]">{log.createdAt}</td>
                  <td className="px-6 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]">{log.duration}</td>
                  <td className="px-6 py-3">
                    {log.status === 'failed' ? (
                      <button
                        onClick={() => handleRetry(log.id)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        重跑
                      </button>
                    ) : log.status === 'running' ? (
                      <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">—</span>
                    ) : (
                      <button onClick={() => router.push(`/dashboard/task-logs/${log.id}`)} className="text-xs text-primary hover:underline">详情</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
