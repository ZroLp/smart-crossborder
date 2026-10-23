'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface AdCampaign {
  id: string
  name: string
  platform: string
  status: 'active' | 'paused' | 'ended'
  budget: number
  spent: number
  roas: number
  clicks: number
  conversions: number
  ctr: number
}

interface AdSuggestion {
  id: string
  type: 'budget_optimization' | 'audience_expansion' | 'creative_refresh' | 'roas_improvement'
  title: string
  description: string
  expectedImpact: string
  action: string
}

const initialCampaigns: AdCampaign[] = [
  { id: 'AD-001', name: '北美户外用品-冬季促销', platform: 'Facebook', status: 'active', budget: 500, spent: 320, roas: 3.2, clicks: 1200, conversions: 45, ctr: 2.8 },
  { id: 'AD-002', name: '欧洲智能手表-新品发布', platform: 'Google', status: 'active', budget: 800, spent: 650, roas: 4.5, clicks: 2100, conversions: 98, ctr: 3.5 },
  { id: 'AD-003', name: '东南亚蓝牙耳机-清仓', platform: 'TikTok', status: 'active', budget: 300, spent: 180, roas: 2.8, clicks: 800, conversions: 22, ctr: 1.9 },
  { id: 'AD-004', name: '日本美妆-春季限定', platform: 'Instagram', status: 'paused', budget: 400, spent: 250, roas: 3.8, clicks: 1500, conversions: 56, ctr: 3.1 },
  { id: 'AD-005', name: '澳洲运动装备-夏季', platform: 'Facebook', status: 'ended', budget: 600, spent: 600, roas: 5.2, clicks: 3000, conversions: 120, ctr: 4.2 },
]

const initialSuggestions: AdSuggestion[] = [
  { id: 'SUG-001', type: 'roas_improvement', title: 'Facebook广告ROAS低于阈值', description: 'AD-001广告组ROAS仅3.2，低于目标值4.0，建议优化受众定向或更换创意素材', expectedImpact: '预计ROAS可提升至4.5+', action: '优化投放' },
  { id: 'SUG-002', type: 'budget_optimization', title: 'Google广告预算分配建议', description: 'AD-002表现优异(ROAS 4.5)，建议增加20%预算以获取更多转化', expectedImpact: '预计日转化可增加30+', action: '增加预算' },
  { id: 'SUG-003', type: 'audience_expansion', title: 'TikTok广告受众扩展', description: 'AD-003 CTR仅1.9%，建议扩大受众范围或更换更吸引人的素材', expectedImpact: '预计CTR可提升至2.5+', action: '扩展受众' },
]

export default function AdOptimizerPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(initialCampaigns)
  const [suggestions, setSuggestions] = useState<AdSuggestion[]>(initialSuggestions)
  const [isLoading, setIsLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [processedSuggestions, setProcessedSuggestions] = useState<Set<string>>(new Set())

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0)
  const avgRoas = campaigns.filter(c => c.status === 'active').reduce((sum, c, _, arr) => sum + c.roas / arr.length, 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)

  const filteredCampaigns = campaigns.filter(c => {
    if (platformFilter !== '全部' && c.platform !== platformFilter) return false
    if (statusFilter !== '全部' && c.status !== statusFilter) return false
    return true
  })

  const handleCreateCampaign = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsLoading(false)
  }

  const handleToggleCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === 'active' ? 'paused' as const : 'active' as const }
      }
      return c
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">智能投流</h2>
        <button onClick={handleCreateCampaign} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          创建广告活动
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
              <div className="h-3 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-[#2A2D35] rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">总预算</p>
            <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{totalBudget.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">已消耗</p>
            <p className="text-xl font-bold text-warning mt-1">¥{totalSpent.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">平均ROAS</p>
            <p className={`text-xl font-bold ${avgRoas < 4 ? 'text-danger' : 'text-success'}`}>{avgRoas.toFixed(1)}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">总点击</p>
            <p className="text-xl font-bold text-primary mt-1">{totalClicks.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">总转化</p>
            <p className="text-xl font-bold text-teal mt-1">{totalConversions}</p>
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">平台筛选</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]">
            <option value="全部">全部平台</option>
            <option value="Facebook">Facebook</option>
            <option value="Google">Google</option>
            <option value="TikTok">TikTok</option>
            <option value="Instagram">Instagram</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">状态筛选</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]">
            <option value="全部">全部状态</option>
            <option value="active">投放中</option>
            <option value="paused">已暂停</option>
            <option value="ended">已结束</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35]">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">广告活动列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] bg-gray-50 dark:bg-[#22252D]">
                <th className="px-6 py-3 font-medium">活动ID</th>
                <th className="px-6 py-3 font-medium">活动名称</th>
                <th className="px-6 py-3 font-medium">平台</th>
                <th className="px-6 py-3 font-medium">状态</th>
                <th className="px-6 py-3 font-medium">预算</th>
                <th className="px-6 py-3 font-medium">消耗</th>
                <th className="px-6 py-3 font-medium">ROAS</th>
                <th className="px-6 py-3 font-medium">CTR</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
              {filteredCampaigns.map((c) => {
                const statusMap = { active: { text: '投放中', color: 'bg-success/10 text-success' }, paused: { text: '已暂停', color: 'bg-warning/10 text-warning' }, ended: { text: '已结束', color: 'bg-gray-100 text-gray-500' } }
                const status = statusMap[c.status]
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#22252D] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-[#4E5969] dark:text-[#A0A4AC]">{c.id}</td>
                    <td className="px-6 py-4 text-[#1D2129] dark:text-[#E8EAED]">{c.name}</td>
                    <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.platform}</span></td>
                    <td className="px-6 py-4"><span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.text}</span></td>
                    <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">¥{c.budget}</td>
                    <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">¥{c.spent}</td>
                    <td className={`px-6 py-4 font-medium ${c.roas < 4 ? 'text-danger' : 'text-success'}`}>{c.roas}</td>
                    <td className="px-6 py-4 text-[#4E5969] dark:text-[#A0A4AC]">{c.ctr}%</td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleCampaign(c.id)} className="text-primary text-xs hover:underline mr-2">
                        {c.status === 'active' ? '暂停' : '启动'}
                      </button>
                      <button onClick={() => router.push(`/dashboard/ad-optimizer/${c.id}`)} className="text-[#4E5969] dark:text-[#A0A4AC] text-xs hover:underline">详情</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">AI优化建议</h3>
        <div className="space-y-4">
          {suggestions.filter(s => !processedSuggestions.has(s.id)).map((s) => {
            const typeMap = { budget_optimization: '💰', audience_expansion: '👥', creative_refresh: '🎨', roas_improvement: '📈' }
            return (
              <div key={s.id} className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{typeMap[s.type]}</span>
                    <div>
                      <h4 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{s.title}</h4>
                      <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1">{s.description}</p>
                      <p className="text-xs text-success mt-2">预期影响: {s.expectedImpact}</p>
                    </div>
                  </div>
                  <button onClick={() => setProcessedSuggestions(prev => { const next = new Set(prev); next.add(s.id); return next })} className="bg-primary text-white text-xs px-3 py-1 rounded-lg hover:opacity-90 whitespace-nowrap">
                    {s.action}
                  </button>
                </div>
              </div>
            )
          })}
          {suggestions.filter(s => !processedSuggestions.has(s.id)).length === 0 && (
            <p className="text-center text-sm text-[#4E5969] dark:text-[#A0A4AC] py-4">暂无优化建议，广告表现良好</p>
          )}
        </div>
      </div>
    </div>
  )
}
