'use client'

import { useParams, useRouter } from 'next/navigation'

const complianceDetails: Record<string, {
  title: string
  category: string
  dueDate: string
  urgency: string
  description: string
  affectedShops: string[]
  requiredActions: { step: number; action: string; deadline: string; status: string }[]
  relatedDocuments: { name: string; type: string; status: string }[]
  history: { date: string; event: string; status: string }[]
}> = {
  '1': {
    title: '美国Sales Tax Q2申报截止',
    category: '美国海关',
    dueDate: '2025-06-15',
    urgency: 'high',
    description: '涉及加州、纽约、德州等12个州的季度销售税申报，需在规定时间内完成各州的纳税申报和缴纳。',
    affectedShops: ['Amazon-US', 'Shopee-US', '独立站-US'],
    requiredActions: [
      { step: 1, action: '收集Q2销售数据', deadline: '2025-06-01', status: 'completed' },
      { step: 2, action: '计算各州应缴税额', deadline: '2025-06-05', status: 'in-progress' },
      { step: 3, action: '准备申报材料', deadline: '2025-06-10', status: 'pending' },
      { step: 4, action: '提交申报并缴纳税款', deadline: '2025-06-15', status: 'pending' },
    ],
    relatedDocuments: [
      { name: 'Q2销售汇总表', type: 'Excel', status: 'ready' },
      { name: '各州税率参考表', type: 'PDF', status: 'ready' },
      { name: '申报模板文件', type: 'Word', status: 'pending' },
    ],
    history: [
      { date: '2025-05-15', event: '收到Q2申报通知', status: 'info' },
      { date: '2025-05-20', event: '开始收集销售数据', status: 'info' },
      { date: '2025-05-28', event: '完成数据收集', status: 'success' },
    ],
  },
  '2': {
    title: '欧盟VAT月度申报',
    category: '税务政策',
    dueDate: '2025-05-25',
    urgency: 'high',
    description: '德国、法国、意大利店铺的月度VAT申报，需在月底前完成申报和缴纳。',
    affectedShops: ['Amazon-DE', 'Amazon-FR', 'Amazon-IT'],
    requiredActions: [
      { step: 1, action: '导出月度销售数据', deadline: '2025-05-18', status: 'completed' },
      { step: 2, action: '计算各国VAT应缴金额', deadline: '2025-05-20', status: 'in-progress' },
      { step: 3, action: '提交VAT申报', deadline: '2025-05-25', status: 'pending' },
    ],
    relatedDocuments: [
      { name: '5月销售明细', type: 'Excel', status: 'ready' },
      { name: 'VAT申报表格', type: 'PDF', status: 'ready' },
    ],
    history: [
      { date: '2025-05-01', event: '月度申报周期开始', status: 'info' },
      { date: '2025-05-15', event: '完成销售数据导出', status: 'success' },
    ],
  },
  '3': {
    title: '日本JCT季度申报',
    category: '税务政策',
    dueDate: '2025-06-30',
    urgency: 'medium',
    description: '合规卖家发票制度相关，需要按照日本国税厅要求完成JCT季度申报。',
    affectedShops: ['Amazon-JP', 'Rakuten-JP'],
    requiredActions: [
      { step: 1, action: '整理季度交易记录', deadline: '2025-06-15', status: 'pending' },
      { step: 2, action: '计算消费税', deadline: '2025-06-20', status: 'pending' },
      { step: 3, action: '提交JCT申报', deadline: '2025-06-30', status: 'pending' },
    ],
    relatedDocuments: [
      { name: 'Q2交易记录', type: 'Excel', status: 'pending' },
      { name: 'JCT申报指南', type: 'PDF', status: 'ready' },
    ],
    history: [
      { date: '2025-05-10', event: '收到JCT申报提醒', status: 'info' },
    ],
  },
  '4': {
    title: '英国VAT季度申报',
    category: '税务政策',
    dueDate: '2025-07-31',
    urgency: 'low',
    description: '英国站店铺统一申报，需要按照HMRC要求完成季度VAT申报。',
    affectedShops: ['Amazon-UK', 'eBay-UK'],
    requiredActions: [
      { step: 1, action: '汇总季度销售数据', deadline: '2025-07-15', status: 'pending' },
      { step: 2, action: '计算应缴VAT', deadline: '2025-07-20', status: 'pending' },
      { step: 3, action: '通过HMRC portal提交', deadline: '2025-07-31', status: 'pending' },
    ],
    relatedDocuments: [
      { name: 'Q2销售数据', type: 'Excel', status: 'pending' },
      { name: 'HMRC申报指引', type: 'PDF', status: 'ready' },
    ],
    history: [
      { date: '2025-05-01', event: '新季度申报周期开始', status: 'info' },
    ],
  },
}

export default function ComplianceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const detail = complianceDetails[id]

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">未找到该合规项</h2>
        <button
          onClick={() => router.push('/dashboard/compliance')}
          className="text-primary hover:underline"
        >
          返回合规中心
        </button>
      </div>
    )
  }

  const urgencyColor: Record<string, string> = {
    high: 'text-danger bg-danger/10',
    medium: 'text-warning bg-warning/10',
    low: 'text-[#4E5969] dark:text-[#A0A4AC] bg-gray-100 dark:bg-[#22252D]',
  }

  const urgencyLabel: Record<string, string> = {
    high: '紧急',
    medium: '一般',
    low: '宽裕',
  }

  const statusColor: Record<string, string> = {
    completed: 'text-success bg-success/10',
    'in-progress': 'text-warning bg-warning/10',
    pending: 'text-[#4E5969] dark:text-[#A0A4AC] bg-gray-100 dark:bg-[#22252D]',
  }

  const statusLabel: Record<string, string> = {
    completed: '已完成',
    'in-progress': '进行中',
    pending: '待处理',
  }

  const docStatusColor: Record<string, string> = {
    ready: 'text-success',
    pending: 'text-warning',
  }

  const docStatusLabel: Record<string, string> = {
    ready: '已准备',
    pending: '待准备',
  }

  const historyStatusColor: Record<string, string> = {
    info: 'text-[#4E5969] dark:text-[#A0A4AC]',
    success: 'text-success',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/compliance')}
            className="text-[#4E5969] dark:text-[#A0A4AC] hover:text-primary transition-colors"
          >
            ← 返回
          </button>
          <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">合规详情</h2>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${urgencyColor[detail.urgency]}`}>
          {urgencyLabel[detail.urgency]}
        </span>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-2">{detail.title}</h3>
        <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-4">{detail.description}</p>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-3">
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">类别</p>
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">{detail.category}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-3">
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">截止日期</p>
            <p className="text-sm font-medium text-danger mt-1">{detail.dueDate}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#22252D] rounded-lg p-3">
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">涉及店铺</p>
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mt-1">{detail.affectedShops.length}个</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED] mb-2">涉及店铺：</p>
          <div className="flex flex-wrap gap-2">
            {detail.affectedShops.map((shop) => (
              <span key={shop} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {shop}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📋 所需操作</h3>
        <div className="space-y-3">
          {detail.requiredActions.map((action) => (
            <div key={action.step} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0">
                {action.step}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{action.action}</p>
                <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">建议完成：{action.deadline}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[action.status]}`}>
                {statusLabel[action.status]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📄 相关文档</h3>
        <div className="space-y-2">
          {detail.relatedDocuments.map((doc) => (
            <div key={doc.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#22252D]">
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <div>
                  <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{doc.name}</p>
                  <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC]">{doc.type}</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${docStatusColor[doc.status]}`}>
                {docStatusLabel[doc.status]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📅 处理记录</h3>
        <div className="space-y-3">
          {detail.history.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full ${historyStatusColor[item.status] === 'text-success' ? 'bg-success' : 'bg-[#4E5969] dark:bg-[#A0A4AC]'}`} />
                {index < detail.history.length - 1 && (
                  <div className="w-px h-8 bg-gray-200 dark:bg-[#2A2D35] mt-1" />
                )}
              </div>
              <div>
                <p className="text-sm text-[#1D2129] dark:text-[#E8EAED]">{item.event}</p>
                <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-0.5">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
