'use client'

const revenueData = [
  { day: '周一', value: 8200, max: 15000 },
  { day: '周二', value: 9500, max: 15000 },
  { day: '周三', value: 7800, max: 15000 },
  { day: '周四', value: 12300, max: 15000 },
  { day: '周五', value: 11200, max: 15000 },
  { day: '周六', value: 10500, max: 15000 },
  { day: '今日', value: 12680, max: 15000 },
]

const comparisonData = [
  { label: '营收', today: '¥12,680', yesterday: '¥10,700', change: '+18.5%', up: true },
  { label: '订单数', today: '86', yesterday: '72', change: '+19.4%', up: true },
  { label: '访客数', today: '2,684', yesterday: '2,396', change: '+12.0%', up: true },
]

const agents = [
  { name: '选品助手', icon: '🔍', status: 'online', tasks: 12 },
  { name: '建站精灵', icon: '🌐', status: 'online', tasks: 8 },
  { name: '文案大师', icon: '✍️', status: 'busy', tasks: 15 },
  { name: '投流专家', icon: '📈', status: 'online', tasks: 6 },
  { name: '客服达人', icon: '💬', status: 'offline', tasks: 3 },
  { name: '物流管家', icon: '📦', status: 'online', tasks: 9 },
]

export default function MobileDashboardPage() {
  return (
    <div className="px-4 pt-6">
      <h1 className="text-lg font-semibold text-gray-600 mb-4">数据看板</h1>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">营收趋势</h2>
        <div className="flex items-end justify-between gap-2 h-32">
          {revenueData.map((item) => (
            <div key={item.day} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-primary rounded-t"
                style={{ height: `${(item.value / item.max) * 100}%` }}
              ></div>
              <span className="text-[10px] text-gray-400 dark:text-[#6B7080] mt-1">{item.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">今日 vs 昨日</h2>
        <div className="space-y-3">
          {comparisonData.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-gray-400 dark:text-[#6B7080]">{item.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">{item.yesterday}</span>
                <span className="text-sm text-gray-600 font-medium">{item.today}</span>
                <span className={`text-xs ${item.up ? 'text-success' : 'text-danger'}`}>
                  {item.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">智能体状态</h2>
        <div className="grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div key={agent.name} className="bg-gray-50 dark:bg-[#22252D] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{agent.icon}</span>
                <span className="text-xs font-medium text-gray-600">{agent.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      agent.status === 'online'
                        ? 'bg-success'
                        : agent.status === 'busy'
                        ? 'bg-warning'
                        : 'bg-gray-300'
                    }`}
                  ></div>
                  <span className="text-[10px] text-gray-400 dark:text-[#6B7080]">
                    {agent.status === 'online'
                      ? '在线'
                      : agent.status === 'busy'
                      ? '忙碌'
                      : '离线'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-[#6B7080]">{agent.tasks}个任务</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
