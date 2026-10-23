'use client'

import { useState, useEffect, useCallback } from 'react'

interface TimeSeriesPoint {
  label: string
  revenue: number
  orders: number
}

interface TrafficSource {
  name: string
  value: number
  color: string
  percentage: string
}

interface ProductRanking {
  rank: number
  name: string
  sales: number
  revenue: number
  trend: 'up' | 'down' | 'flat'
}

interface RevenueStats {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  conversionRate: number
}

const COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#D97706', '#DC2626']

const generateTimeSeries = (days: number): TimeSeriesPoint[] => {
  const points: TimeSeriesPoint[] = []
  const now = new Date()
  let baseRevenue = 15000
  let baseOrders = 120
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dayFactor = 0.7 + Math.random() * 0.6
    const weekendFactor = [0, 6].includes(date.getDay()) ? 1.3 : 1
    baseRevenue = Math.floor(baseRevenue * (0.95 + Math.random() * 0.15) * weekendFactor)
    baseOrders = Math.floor(baseOrders * (0.9 + Math.random() * 0.2) * weekendFactor)
    points.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      revenue: baseRevenue,
      orders: baseOrders,
    })
  }
  return points
}

const generateTrafficSources = (): TrafficSource[] => {
  const total = 45678
  const sources = [
    { name: '自然搜索', value: 15234 },
    { name: '付费广告', value: 12456 },
    { name: '社交流量', value: 8901 },
    { name: '直接访问', value: 5678 },
    { name: '推荐引荐', value: 3409 },
  ]
  return sources.map((s, i) => ({
    ...s,
    color: COLORS[i],
    percentage: ((s.value / total) * 100).toFixed(1) + '%',
  }))
}

const generateProductRankings = (): ProductRanking[] => {
  const names = ['无线蓝牙耳机', '智能手表', '便携充电宝', '运动水杯', '手机壳', '蓝牙音箱', '充电线', '笔记本电脑支架']
  return names.map((name, i) => ({
    rank: i + 1,
    name,
    sales: Math.floor(5000 - i * 450 + Math.random() * 200),
    revenue: Math.floor(150000 - i * 35000 + Math.random() * 10000),
    trend: (['up', 'up', 'flat', 'down', 'up', 'down', 'flat', 'up'][i]) as 'up' | 'down' | 'flat',
  }))
}

function MiniLineChart({ data, color, height = 160, showDots = true }: { data: number[]; color: string; height?: number; showDots?: boolean }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 400
  const padding = 10

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
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
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
    </svg>
  )
}

function BarChart({ data, labels, height = 200 }: { data: number[]; labels: string[]; height?: number }) {
  const max = Math.max(...data)
  const width = 400
  const padding = 40
  const barWidth = (width - padding * 2) / data.length * 0.7
  const gap = (width - padding * 2) / data.length * 0.3

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {data.map((v, i) => {
        const x = padding + i * (barWidth + gap)
        const barHeight = (v / max) * (height - padding - 30)
        const y = height - padding - barHeight
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={COLORS[i % COLORS.length]} opacity="0.85" />
            <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#4E5969">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
            <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="#86909C">
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ sources }: { sources: TrafficSource[] }) {
  const size = 180
  const strokeWidth = 30
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = sources.reduce((sum, s) => sum + s.value, 0)

  let currentOffset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {sources.map((s, i) => {
          const segmentLength = (s.value / total) * circumference
          const dashArray = `${segmentLength} ${circumference - segmentLength}`
          const dashOffset = -currentOffset
          currentOffset += segmentLength

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-all duration-500"
            />
          )
        })}
        <text x={size / 2} y={size / 2 - 8} textAnchor="middle" fontSize="16" fontWeight="600" fill="#1D2129">
          {total.toLocaleString()}
        </text>
        <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize="10" fill="#86909C">
          总访问量
        </text>
      </svg>
      <div className="space-y-2">
        {sources.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[#4E5969] dark:text-[#A0A4AC]">{s.name}</span>
            <span className="font-medium text-[#1D2129] dark:text-[#E8EAED]">{s.percentage}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DataCenterPage() {
  const [dateRange, setDateRange] = useState('7d')
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([])
  const [productRankings, setProductRankings] = useState<ProductRanking[]>([])

  const fetchData = useCallback(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 14
    const series = generateTimeSeries(days)
    const totalRevenue = series.reduce((sum, s) => sum + s.revenue, 0)
    const totalOrders = series.reduce((sum, s) => sum + s.orders, 0)

    setRevenueStats({
      totalRevenue,
      totalOrders,
      avgOrderValue: Math.round(totalRevenue / (totalOrders || 1)),
      conversionRate: parseFloat((2.5 + Math.random() * 2).toFixed(2)),
    })
    setTimeSeries(series)
    setTrafficSources(generateTrafficSources())
    setProductRankings(generateProductRankings())
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">数据中心</h2>
        <div className="flex gap-3 items-center">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
          >
            <option value="7d">近7天</option>
            <option value="30d">近30天</option>
            <option value="90d">近90天</option>
            <option value="custom">自定义</option>
          </select>
          <button onClick={() => {
            const headers = '日期,营收,订单数,客单价,转化率\n'
            const rows = timeSeries.map(s => `${s.label},${s.revenue},${s.orders},${revenueStats?.avgOrderValue || 0},${revenueStats?.conversionRate || 0}`).join('\n')
            const csv = headers + rows
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `data-center-report-${dateRange}.csv`; a.click()
            URL.revokeObjectURL(url)
          }} className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            导出报表
          </button>
        </div>
      </div>

      {revenueStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">总营收</p>
            <p className="text-2xl font-bold text-[#1D2129] dark:text-[#E8EAED] mt-1">¥{revenueStats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">总订单</p>
            <p className="text-2xl font-bold text-primary mt-1">{revenueStats.totalOrders.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">客单价</p>
            <p className="text-2xl font-bold text-success mt-1">¥{revenueStats.avgOrderValue}</p>
          </div>
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5">
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">转化率</p>
            <p className="text-2xl font-bold text-purple mt-1">{revenueStats.conversionRate}%</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📈 营收趋势</h3>
        {timeSeries.length > 0 && (
          <div>
            <MiniLineChart data={timeSeries.map(s => s.revenue)} color="#1D4ED8" height={180} />
            <div className="flex justify-between text-xs text-[#86909C] mt-2">
              {timeSeries.filter((_, i) => i % Math.ceil(timeSeries.length / 7) === 0).map((s, i) => (
                <span key={i}>{s.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📦 订单趋势</h3>
          {timeSeries.length > 0 && (
            <div>
              <MiniLineChart data={timeSeries.map(s => s.orders)} color="#059669" height={160} />
              <div className="flex justify-between text-xs text-[#86909C] mt-2">
                {timeSeries.filter((_, i) => i % Math.ceil(timeSeries.length / 5) === 0).map((s, i) => (
                  <span key={i}>{s.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🌐 流量来源</h3>
          <DonutChart sources={trafficSources} />
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🏆 商品排行</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC]">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium">商品</th>
                  <th className="pb-3 font-medium text-right">销量</th>
                  <th className="pb-3 font-medium text-right">营收</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#22252D]">
                {productRankings.map((p) => (
                  <tr key={p.rank}>
                    <td className="py-2 text-[#86909C]">{p.rank}</td>
                    <td className="py-2 text-[#1D2129] dark:text-[#E8EAED]">{p.name}</td>
                    <td className="py-2 text-right text-[#1D2129] dark:text-[#E8EAED]">{p.sales.toLocaleString()}</td>
                    <td className="py-2 text-right text-primary font-medium">¥{p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <BarChart
              data={productRankings.map(p => p.revenue)}
              labels={productRankings.map((_, i) => `#${i + 1}`)}
              height={200}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
