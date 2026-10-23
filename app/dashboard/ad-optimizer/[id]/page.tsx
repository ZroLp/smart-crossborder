'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface AdCampaignDetail {
  id: string
  name: string
  platform: string
  status: 'active' | 'paused' | 'ended'
  budget: number
  spent: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cvr: number
  roas: number
  cpa: number
  cpc: number
  createdAt: string
  updatedAt: string
  manager: string
}

interface TrendPoint {
  label: string
  impressions: number
  clicks: number
  conversions: number
  roas: number
}

interface AudienceItem {
  range?: string
  name?: string
  percentage: number
}

interface AudienceData {
  ageGroups: AudienceItem[]
  regions: AudienceItem[]
  devices: AudienceItem[]
}

interface CreativeItem {
  id: string
  name: string
  thumbnail: string
  ctr: number
  conversions: number
}

const MOCK_CAMPAIGNS: Record<string, AdCampaignDetail> = {
  'AD-001': {
    id: 'AD-001',
    name: '北美户外用品-冬季促销',
    platform: 'Facebook',
    status: 'active',
    budget: 500,
    spent: 320,
    impressions: 45600,
    clicks: 1200,
    conversions: 45,
    ctr: 2.8,
    cvr: 3.75,
    roas: 3.2,
    cpa: 7.11,
    cpc: 0.27,
    createdAt: '2025-05-01 09:00',
    updatedAt: '2025-05-23 14:30',
    manager: '张三',
  },
  'AD-002': {
    id: 'AD-002',
    name: '欧洲智能手表-新品发布',
    platform: 'Google',
    status: 'active',
    budget: 800,
    spent: 650,
    impressions: 68200,
    clicks: 2100,
    conversions: 98,
    ctr: 3.5,
    cvr: 4.67,
    roas: 4.5,
    cpa: 6.63,
    cpc: 0.31,
    createdAt: '2025-04-15 10:00',
    updatedAt: '2025-05-23 15:00',
    manager: '李四',
  },
}

const generateTrendData = (days: number): TrendPoint[] => {
  const points: TrendPoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    points.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      impressions: Math.floor(5000 + Math.random() * 3000),
      clicks: Math.floor(100 + Math.random() * 80),
      conversions: Math.floor(3 + Math.random() * 10),
      roas: parseFloat((2.5 + Math.random() * 2.5).toFixed(2)),
    })
  }
  return points
}

const MOCK_AUDIENCE: AudienceData = {
  ageGroups: [
    { range: '18-24', percentage: 35 },
    { range: '25-34', percentage: 40 },
    { range: '35-44', percentage: 18 },
    { range: '45+', percentage: 7 },
  ],
  regions: [
    { name: '美国', percentage: 60 },
    { name: '加拿大', percentage: 25 },
    { name: '英国', percentage: 10 },
    { name: '其他', percentage: 5 },
  ],
  devices: [
    { name: '移动端', percentage: 72 },
    { name: '桌面端', percentage: 22 },
    { name: '平板', percentage: 6 },
  ],
}

const MOCK_CREATIVES: CreativeItem[] = [
  { id: 'CR-001', name: '主图A-户外场景', thumbnail: '🏔️', ctr: 3.2, conversions: 18 },
  { id: 'CR-002', name: '主图B-产品特写', thumbnail: '📷', ctr: 2.1, conversions: 12 },
  { id: 'CR-003', name: '视频C-使用演示', thumbnail: '🎬', ctr: 1.8, conversions: 8 },
]

function MiniLineChart({ data, color, height = 120 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 400
  const padding = 8

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
  const gradientId = `grad-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  return (
    <div className="w-full bg-gray-100 dark:bg-[#2A2D35] rounded-full h-2.5">
      <div
        className={`${color} h-2.5 rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function AgeBar({ data }: { data: AudienceItem[] }) {
  const colors = ['bg-primary', 'bg-purple', 'bg-teal', 'bg-orange']
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={item.range || item.name || i} className="flex items-center gap-3">
          <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC] w-10">{item.range || item.name || ''}</span>
          <div className="flex-1">
            <div className="w-full bg-gray-100 dark:bg-[#2A2D35] rounded-full h-2">
              <div
                className={`${colors[i % colors.length]} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-[#1D2129] dark:text-[#E8EAED] w-10 text-right">{item.percentage}%</span>
        </div>
      ))}
    </div>
  )
}

export default function AdCampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<AdCampaignDetail | null>(null)
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [audienceData] = useState<AudienceData>(MOCK_AUDIENCE)
  const [creatives, setCreatives] = useState<CreativeItem[]>(MOCK_CREATIVES)
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('7d')
  const [isLoading, setIsLoading] = useState(true)

  const fetchCampaignData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/data?type=ad-campaigns&id=${campaignId}`)
      const data = await res.json()
      if (data.success && data.data) {
        setCampaign({ ...MOCK_CAMPAIGNS[campaignId] || MOCK_CAMPAIGNS['AD-001'], ...data.data })
      } else {
        setCampaign(MOCK_CAMPAIGNS[campaignId] || MOCK_CAMPAIGNS['AD-001'])
      }
    } catch {
      setCampaign(MOCK_CAMPAIGNS[campaignId] || MOCK_CAMPAIGNS['AD-001'])
    } finally {
      setIsLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchCampaignData()
  }, [fetchCampaignData])

  useEffect(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30
    setTrendData(generateTrendData(days))
  }, [timeRange])

  const handleToggleCampaign = async () => {
    if (!campaign) return
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    setCampaign({ ...campaign, status: newStatus })
  }

  const handleDownloadReport = () => {
    if (!campaign) return
    const headers = '日期,曝光量,点击量,转化量,ROAS\n'
    const rows = trendData.map(t => `${t.label},${t.impressions},${t.clicks},${t.conversions},${t.roas}`).join('\n')
    const csv = headers + rows
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ad-report-${campaign.id}-${timeRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-[#2A2D35] rounded w-1/4"></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-[#22252D] rounded-xl"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#4E5969] dark:text-[#A0A4AC]">
        <span className="text-4xl mb-4">📊</span>
        <p className="text-base">未找到广告活动详情</p>
        <button onClick={() => router.back()} className="mt-4 text-primary text-sm hover:underline">返回</button>
      </div>
    )
  }

  const budgetPercentage = Math.round((campaign.spent / campaign.budget) * 100)
  const remainingBudget = campaign.budget - campaign.spent
  const dailyAvgSpend = campaign.spent / Math.max(1, Math.ceil((Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
  const estimatedDaysLeft = dailyAvgSpend > 0 ? Math.round(remainingBudget / dailyAvgSpend) : 0

  const statusMap = {
    active: { text: '投放中', color: 'bg-success/10 text-success' },
    paused: { text: '已暂停', color: 'bg-warning/10 text-warning' },
    ended: { text: '已结束', color: 'bg-gray-100 text-gray-500' },
  }
  const status = statusMap[campaign.status]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-[#1D2129] dark:hover:text-[#E8EAED] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{campaign.name}</h2>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] font-mono">{campaign.id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadReport}
            className="bg-gray-100 dark:bg-[#2A2D35] text-[#1D2129] dark:text-[#E8EAED] px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            下载报告
          </button>
          <button
            onClick={handleToggleCampaign}
            disabled={campaign.status === 'ended'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 ${
              campaign.status === 'active'
                ? 'bg-warning text-white hover:opacity-90'
                : 'bg-primary text-white hover:opacity-90'
            }`}
          >
            {campaign.status === 'active' ? '暂停' : '启动'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">投放平台</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{campaign.platform}</span>
            </p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">活动状态</span>
            <p className={`font-medium mt-1 ${status.color} px-2 py-0.5 rounded-full text-xs inline-block`}>{status.text}</p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">负责人</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">{campaign.manager}</p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">创建时间</span>
            <p className="font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1 text-xs">{campaign.createdAt}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">💰 预算与消耗</h3>
          <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">¥{campaign.spent} / ¥{campaign.budget}</span>
        </div>
        <ProgressBar value={campaign.spent} max={campaign.budget} color={budgetPercentage > 80 ? 'bg-danger' : 'bg-primary'} />
        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">预算使用率</span>
            <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">{budgetPercentage}%</p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">日均消耗</span>
            <p className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{dailyAvgSpend.toFixed(1)}</p>
          </div>
          <div>
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">预计剩余天数</span>
            <p className={`text-lg font-semibold mt-1 ${estimatedDaysLeft <= 3 ? 'text-danger' : 'text-success'}`}>
              {estimatedDaysLeft > 0 ? `${estimatedDaysLeft}天` : '已超预算'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">曝光量</p>
          <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">{(campaign.impressions / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">点击量</p>
          <p className="text-xl font-bold text-primary mt-1">{campaign.clicks.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">CTR</p>
          <p className={`text-xl font-bold ${campaign.ctr < 2 ? 'text-danger' : 'text-success'}`}>{campaign.ctr}%</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">转化量</p>
          <p className="text-xl font-bold text-teal mt-1">{campaign.conversions}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">ROAS</p>
          <p className={`text-xl font-bold ${campaign.roas < 4 ? 'text-warning' : 'text-success'}`}>{campaign.roas}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">CPA (单次转化成本)</p>
          <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{campaign.cpa}</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">CPC (单次点击成本)</p>
          <p className="text-xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{campaign.cpc}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">📉 趋势分析</h3>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '14d' | '30d')}
            className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
          >
            <option value="7d">近7天</option>
            <option value="14d">近14天</option>
            <option value="30d">近30天</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-2">曝光趋势</p>
            <MiniLineChart data={trendData.map(t => t.impressions)} color="#1D4ED8" height={120} />
          </div>
          <div>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-2">点击趋势</p>
            <MiniLineChart data={trendData.map(t => t.clicks)} color="#059669" height={120} />
          </div>
        </div>
        <div className="flex justify-between text-xs text-[#86909C] mt-2">
          {trendData.filter((_, i) => i % Math.ceil(trendData.length / 7) === 0).map((t, i) => (
            <span key={i}>{t.label}</span>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">👥 受众分析</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3">年龄分布</p>
            <AgeBar data={audienceData.ageGroups} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3">地区分布</p>
            <AgeBar data={audienceData.regions} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3">设备分布</p>
            <AgeBar data={audienceData.devices} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">🎨 创意素材</h3>
          {creatives.length > 0 && (
            <span className="text-xs text-warning bg-warning/10 px-2 py-1 rounded-full">AI建议: 更换CTR低于2%的素材</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {creatives.map((c) => (
            <div key={c.id} className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg h-32 flex items-center justify-center mb-3">
                <span className="text-4xl">{c.thumbnail}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{c.name}</span>
                <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC] font-mono">{c.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#4E5969] dark:text-[#A0A4AC]">CTR: <span className={`font-medium ${c.ctr < 2 ? 'text-danger' : 'text-success'}`}>{c.ctr}%</span></span>
                <span className="text-[#4E5969] dark:text-[#A0A4AC]">转化: <span className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{c.conversions}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}