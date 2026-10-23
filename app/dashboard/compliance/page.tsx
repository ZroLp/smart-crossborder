'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const policyUpdates = [
  { id: 1, title: '欧盟《数字服务法》(DSA)合规要求更新', date: '2025-05-18', category: '欧盟法规', status: 'new' },
  { id: 2, title: '美国海关跨境电商小额免税额度调整通知', date: '2025-05-15', category: '美国海关', status: 'new' },
  { id: 3, title: '日本消费税JCT申报规则变更', date: '2025-05-10', category: '税务政策', status: 'read' },
  { id: 4, title: '东南亚各国电子产品进口标准更新', date: '2025-05-06', category: '产品标准', status: 'read' },
  { id: 5, title: '英国UKCA认证过渡期结束提醒', date: '2025-04-28', category: '认证标准', status: 'read' },
]

const taxReminders = [
  { id: 1, title: '美国Sales Tax Q2申报截止', dueDate: '2025-06-15', urgency: 'high', desc: '涉及加州、纽约、德州等12个州' },
  { id: 2, title: '欧盟VAT月度申报', dueDate: '2025-05-25', urgency: 'high', desc: '德国、法国、意大利店铺' },
  { id: 3, title: '日本JCT季度申报', dueDate: '2025-06-30', urgency: 'medium', desc: '合规卖家发票制度相关' },
  { id: 4, title: '英国VAT季度申报', dueDate: '2025-07-31', urgency: 'low', desc: '英国站店铺统一申报' },
]

const complianceChecks = [
  { area: '店铺营业资质', icon: '📄', status: 'pass', detail: '所有店铺资质有效' },
  { area: '产品合规检测', icon: '🧪', status: 'warning', detail: '3个商品缺少CE认证' },
  { area: '支付合规审查', icon: '💳', status: 'pass', detail: '支付渠道符合PCI DSS标准' },
  { area: '数据隐私保护', icon: '🔒', status: 'warning', detail: 'GDPR Cookie声明需更新' },
  { area: '税务登记状态', icon: '🏛️', status: 'fail', detail: '法国站VAT登记即将过期' },
]

const riskItems = [
  { id: 1, severity: 'high', title: '法国站VAT登记过期风险', area: '税务登记', desc: '法国站VAT税号将于2025-06-30到期，需提前续期' },
  { id: 2, severity: 'high', title: 'CE认证缺失可能导致下架', area: '产品合规', desc: '3款电子产品缺少有效CE认证证书' },
  { id: 3, severity: 'medium', title: 'GDPR Cookie政策未更新', area: '数据隐私', desc: 'Cookie同意弹窗不符合最新ePrivacy规范' },
  { id: 4, severity: 'medium', title: '亚马逊产品图片版权风险', area: '知识产权', desc: '2款商品主图可能侵犯第三方版权' },
  { id: 5, severity: 'low', title: '德国包装法注册到期', area: '产品合规', desc: 'LUCID包装法注册需年度续费' },
]

const suggestions = [
  { id: 1, riskId: 1, action: '立即联系税务代理续期法国VAT', deadline: '2025-05-30', priority: 'high' },
  { id: 2, riskId: 2, action: '联系供应商获取CE认证文件或更换合规产品', deadline: '2025-06-10', priority: 'high' },
  { id: 3, riskId: 3, action: '更新网站Cookie政策页面，升级同意弹窗', deadline: '2025-06-15', priority: 'medium' },
  { id: 4, riskId: 4, action: '使用原创图片或购买商用授权图片', deadline: '2025-06-20', priority: 'medium' },
  { id: 5, riskId: 5, action: '登录LUCID平台完成年度续费', deadline: '2025-07-01', priority: 'low' },
]

export default function CompliancePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'policy' | 'tax' | 'check' | 'risk'>('all')
  const [scanning, setScanning] = useState(false)
  const [processedSuggestions, setProcessedSuggestions] = useState<Set<number>>(new Set())

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'policy', label: '政策更新' },
    { key: 'tax', label: '税务提醒' },
    { key: 'check', label: '合规检测' },
    { key: 'risk', label: '风险清单' },
  ]

  const statusColor: Record<string, string> = {
    pass: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    fail: 'text-danger bg-danger/10',
  }

  const statusLabel: Record<string, string> = {
    pass: '通过',
    warning: '警告',
    fail: '不通过',
  }

  const severityColor: Record<string, string> = {
    high: 'text-danger bg-danger/10',
    medium: 'text-warning bg-warning/10',
    low: 'text-primary bg-primary/10',
  }

  const severityLabel: Record<string, string> = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
  }

  const urgencyColor: Record<string, string> = {
    high: 'text-danger',
    medium: 'text-warning',
    low: 'text-[#4E5969] dark:text-[#A0A4AC]',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">合规风险中心</h2>
        <button
          onClick={() => {
            if (scanning) return;
            setScanning(true);
            setTimeout(() => { setScanning(false); }, 2000);
          }}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {scanning ? '检测中...' : '一键合规检测'}
        </button>
      </div>

      <div className="flex gap-2 bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'text-[#4E5969] dark:text-[#A0A4AC] hover:bg-gray-50 dark:hover:bg-[#22252D]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">政策更新</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">5</p>
          <p className="text-caption text-danger mt-1">2条未读</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">待处理税务</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">4</p>
          <p className="text-caption text-danger mt-1">2项紧急</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">风险项</p>
          <p className="text-h1 text-[#1D2129] dark:text-[#E8EAED] mt-1">5</p>
          <p className="text-caption text-danger mt-1">2项高风险</p>
        </div>
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">合规得分</p>
          <p className="text-h1 text-warning mt-1">72</p>
          <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-1">满分100</p>
        </div>
      </div>

      {(activeTab === 'all' || activeTab === 'policy') && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📋 政策更新</h3>
          <div className="divide-y divide-gray-100 dark:divide-[#2A2D35]">
            {policyUpdates.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'new' ? 'bg-danger' : 'bg-gray-200 dark:bg-[#2A2D35]'}`} />
                  <div>
                    <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{item.title}</p>
                    <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">{item.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">{item.category}</span>
                  {item.status === 'new' && (
                    <span className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full">新</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'tax') && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">💰 税务提醒</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxReminders.map((item) => (
              <div key={item.id} className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{item.title}</span>
                  <span className={`text-caption font-medium ${urgencyColor[item.urgency]}`}>
                    {item.urgency === 'high' ? '紧急' : item.urgency === 'medium' ? '一般' : '宽裕'}
                  </span>
                </div>
                <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mb-2">{item.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">截止日期：{item.dueDate}</span>
                  <button onClick={() => router.push(`/dashboard/compliance/${item.id}`)} className="text-xs text-primary hover:underline">查看详情</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'check') && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">✅ 合规检测</h3>
          <div className="space-y-3">
            {complianceChecks.map((item) => (
              <div key={item.area} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{item.area}</p>
                    <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC]">{item.detail}</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor[item.status]}`}>
                  {statusLabel[item.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'risk') && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">⚠️ 风险清单</h3>
          <div className="space-y-3">
            {riskItems.map((item) => (
              <div key={item.id} className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[item.severity]}`}>
                        {severityLabel[item.severity]}
                      </span>
                      <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">{item.area}</span>
                    </div>
                    <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mt-2">{item.title}</p>
                    <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-1">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'all' || activeTab === 'risk') && (
        <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
          <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">💡 整改建议</h3>
          <div className="space-y-3">
            {suggestions.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[item.priority]}`}>
                    {item.priority === 'high' ? '优先' : item.priority === 'medium' ? '建议' : '可选'}
                  </span>
                  <div>
                    <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{item.action}</p>
                    <p className="text-caption text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">建议完成日期：{item.deadline}</p>
                  </div>
                </div>
                <button
                  onClick={() => setProcessedSuggestions(prev => { const next = new Set(prev); next.add(item.id); return next; })}
                  className={`text-xs hover:underline whitespace-nowrap ${processedSuggestions.has(item.id) ? 'text-gray-400 line-through pointer-events-none' : 'text-primary'}`}
                  disabled={processedSuggestions.has(item.id)}
                >
                  {processedSuggestions.has(item.id) ? '已处理' : '标记已处理'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
