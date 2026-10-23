'use client'

import { useState, useCallback } from 'react'
import VoiceInputButton from '@/components/VoiceInputButton'

const quickCommands = [
  { name: '选品分析', icon: '🔍', color: 'bg-primary/10 text-primary' },
  { name: '生成文案', icon: '✍️', color: 'bg-purple/10 text-purple' },
  { name: '优化投放', icon: '📈', color: 'bg-success/10 text-success' },
  { name: '查看订单', icon: '📦', color: 'bg-warning/10 text-warning' },
  { name: '客服回复', icon: '💬', color: 'bg-primary/10 text-primary' },
  { name: '物流查询', icon: '🚚', color: 'bg-purple/10 text-purple' },
]

const commandHistory = [
  { command: '分析北美市场夏季热销品', status: 'done', time: '10:30' },
  { command: '生成无线蓝牙耳机英文文案', status: 'done', time: '09:45' },
  { command: '优化Shopee店铺广告投放', status: 'running', time: '09:20' },
  { command: '查询ORD-2024001物流状态', status: 'done', time: '08:50' },
  { command: '分析竞品定价策略', status: 'done', time: '08:30' },
]

export default function MobileCommandPage() {
  const [command, setCommand] = useState('')

  const handleVoiceResult = useCallback((text: string) => {
    setCommand((prev) => (prev ? prev + text : text))
  }, [])

  return (
    <div className="px-4 pt-6">
      <h1 className="text-lg font-semibold text-gray-600 mb-4">AI指令</h1>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="输入自然语言指令..."
            className="flex-1 bg-gray-50 dark:bg-[#22252D] rounded-xl px-4 py-3 text-sm text-gray-600 outline-none min-w-0"
          />
          <VoiceInputButton onResult={handleVoiceResult} />
          <button
            onClick={() => {
              if (!command.trim()) return;
              setCommand('');
            }}
            className="bg-primary text-white px-5 rounded-xl text-sm font-medium flex-shrink-0"
          >
            发送
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">快捷指令</h2>
        <div className="grid grid-cols-3 gap-2">
          {quickCommands.map((cmd) => (
            <button
              key={cmd.name}
              onClick={() => setCommand(cmd.name + '，')}
              className={`${cmd.color} rounded-xl p-3 flex flex-col items-center gap-1`}
            >
              <span className="text-lg">{cmd.icon}</span>
              <span className="text-[11px] font-medium">{cmd.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">当前任务进度</h2>
        <div className="bg-primary/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">优化Shopee店铺广告投放</span>
            <span className="text-xs text-primary">执行中</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#22252D] rounded-full h-2 mb-2">
            <div className="bg-primary rounded-full h-2" style={{ width: '65%' }}></div>
          </div>
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">正在分析广告数据并生成优化建议...</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">指令历史</h2>
        <div className="space-y-3">
          {commandHistory.map((item, index) => (
            <div key={index} className="flex items-center gap-3 py-2">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  item.status === 'done' ? 'bg-success' : 'bg-primary'
                }`}
              ></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 truncate">{item.command}</p>
                <p className="text-xs text-gray-300 mt-0.5">{item.time}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  item.status === 'done'
                    ? 'bg-success/10 text-success'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {item.status === 'done' ? '已完成' : '执行中'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
