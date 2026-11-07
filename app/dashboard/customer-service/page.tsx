'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'

interface FAQ {
  id: string
  q: string
  a: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface CustomerServiceStats {
  responseRate: string
  avgResponseTime: string
  todaySessions: number
}

const DEFAULT_FAQS: FAQ[] = [
  { id: 'default-1', q: '如何查询订单？', a: '请在订单页面输入订单号查询' },
  { id: 'default-2', q: '如何退换货？', a: '请在订单详情页申请退换货' },
]

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** 兼容新契约 data.result.data.response 与旧 mock 数据的 data.response。 */
function extractReply(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, any>
  const fromResult = record.result?.data?.response
  if (typeof fromResult === 'string' && fromResult) return fromResult
  if (typeof record.response === 'string' && record.response) return record.response
  if (typeof record.data?.response === 'string' && record.data.response) return record.data.response
  return null
}

export default function CustomerServicePage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '您好！我是AI客服助手，有什么可以帮您的吗？',
      timestamp: new Date().toISOString(),
    },
  ])
  const [faqs, setFaqs] = useState<FAQ[]>(DEFAULT_FAQS)
  const [stats, setStats] = useState<CustomerServiceStats>({
    responseRate: '--',
    avgResponseTime: '--',
    todaySessions: 0,
  })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchCustomerServiceData = useCallback(async () => {
    try {
      setIsLoadingData(true)
      const res = await fetch('/api/data?type=task-logs&agentType=customer-service&limit=50')
      const data = await res.json()
      if (data.success && data.data) {
        const logs = data.data
        const faqItems = logs
          .filter((l: any) => l.type === 'faq' || l.question)
          .slice(0, 10)
          .map((l: any, i: number) => ({
            id: l.id || `faq-${i}`,
            q: l.question || l.q || l.title || `问题${i + 1}`,
            a: l.answer || l.a || l.content || '暂无回答',
          }))

        setFaqs(faqItems.length > 0 ? faqItems : DEFAULT_FAQS)

        const completedSessions = logs.filter(
          (l: any) => l.status === 'completed' || l.status === 'resolved'
        ).length
        const totalSessions = logs.length
        setStats({
          responseRate:
            totalSessions > 0 ? `${Math.round((completedSessions / totalSessions) * 100)}%` : '--',
          avgResponseTime: '1.2s',
          todaySessions: totalSessions,
        })
      } else {
        setFaqs(DEFAULT_FAQS)
        setStats({ responseRate: '--', avgResponseTime: '--', todaySessions: 0 })
      }
    } catch {
      setFaqs(DEFAULT_FAQS)
      setStats({ responseRate: '--', avgResponseTime: '--', todaySessions: 0 })
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomerServiceData()
  }, [fetchCustomerServiceData])

  const {
    submit,
    pause,
    terminate,
    retry,
    displayId,
    taskId,
    taskStatus,
    steps,
    error,
    submitting,
    controlling,
    isActive,
    clearError,
  } = useAgentTask({
    agentType: 'customer-service',
    onTerminal: (status) => {
      if (status === 'completed') {
        void fetchCustomerServiceData()
      }
    },
  })

  const appendMessage = (role: ChatMessage['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}`,
        role,
        content,
        timestamp: new Date().toISOString(),
      },
    ])
  }

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    const history = messages.slice(-5)
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const outcome = await submit({
        message: userMessage.content,
        conversationHistory: history,
      })
      if (!outcome.ok) {
        appendMessage('assistant', '抱歉，服务暂时不可用，请稍后再试。')
        return
      }
      const reply = extractReply(outcome.data)
      if (reply) {
        appendMessage('assistant', reply)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  const handleFAQClick = (faq: FAQ) => {
    setInput(faq.q)
    textareaRef.current?.focus()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">智能客服</h2>

      {error && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 bg-white dark:bg-[#181A20] rounded-xl shadow-sm flex flex-col"
          style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}
        >
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2A2D35] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED]">AI客服助手</h3>
                <p className="text-xs text-success">在线</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            {isLoadingData && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">正在加载客服数据...</p>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm">🤖</span>
                  </div>
                )}
                <div className={`max-w-[70%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : 'bg-gray-100 dark:bg-[#22252D] text-[#1D2129] dark:text-[#E8EAED] rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p
                    className={`text-xs text-[#86909C] mt-1 ${
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-[#2A2D35] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm text-white"></span>
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="bg-gray-100 dark:bg-[#22252D] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 bg-[#86909C] rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-[#86909C] rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 bg-[#86909C] rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2A2D35]">
            <div className="flex gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Shift+Enter换行)"
                rows={1}
                className="flex-1 border border-gray-200 dark:border-[#2A2D35] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-primary dark:text-[#E8EAED] dark:placeholder-[#6B7080] max-h-[120px] overflow-y-auto"
                disabled={isSending}
              />
              <button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {isSending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    发送中
                  </span>
                ) : (
                  '发送'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3 flex items-center gap-2">
              <span>📊</span> 客服统计
            </h3>
            {isLoadingData ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 w-20 bg-gray-100 dark:bg-[#22252D] rounded animate-pulse" />
                    <div className="h-4 w-12 bg-gray-100 dark:bg-[#22252D] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">响应率</span>
                  <span
                    className={`font-medium ${
                      stats.responseRate === '--'
                        ? 'text-[#86909C]'
                        : stats.responseRate === '0%'
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {stats.responseRate}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">平均响应时间</span>
                  <span
                    className={`font-medium ${
                      stats.avgResponseTime === '--' ? 'text-[#86909C]' : 'text-primary'
                    }`}
                  >
                    {stats.avgResponseTime}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">今日会话</span>
                  <span className="font-medium text-[#1D2129] dark:text-[#E8EAED]">
                    {stats.todaySessions}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-3 flex items-center gap-2">
              <span>📚</span> 知识库
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {isLoadingData ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 dark:bg-[#22252D] rounded-lg animate-pulse"
                    >
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-[#2A2D35] rounded" />
                      <div className="h-3 w-1/2 bg-gray-200 dark:bg-[#2A2D35] rounded mt-2" />
                    </div>
                  ))}
                </div>
              ) : (
                faqs.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleFAQClick(f)}
                    className="text-sm p-3 rounded-lg hover:bg-primary/5 dark:hover:bg-[#2A2D35] cursor-pointer transition-colors group"
                  >
                    <p className="text-[#1D2129] dark:text-[#E8EAED] group-hover:text-primary transition-colors">
                      {f.q}
                    </p>
                    <p className="text-[#4E5969] dark:text-[#A0A4AC] text-xs mt-1 line-clamp-2">
                      {f.a}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isActive && (displayId || taskId) && (
        <AIStepProgress
          taskId={(displayId || taskId) as string}
          steps={steps}
          taskStatus={taskStatus}
          errorMessage={error}
          busy={controlling}
          onPause={pause}
          onTerminate={terminate}
          onRetry={retry}
          onDismissError={clearError}
        />
      )}
    </div>
  )
}
