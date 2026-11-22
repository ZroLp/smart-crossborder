'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge } from '@/components/MobileCard'

interface TaskLog {
  taskId: string
  agentType: string
  taskName: string
  status: string
  createdAt: string
}

interface CommandDef {
  key: string
  agentType: 'selection' | 'content' | 'ad-optimizer' | 'customer-service' | 'fulfillment'
  input: () => Record<string, unknown>
}

export default function MobileCommandPage() {
  const { t } = useTranslation()
  const history = useApi(() => getJson<{ data: TaskLog[] }>('/api/task-logs?limit=10'))
  const [keyword, setKeyword] = useState('')
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function runCommand(agentType: CommandDef['agentType'], input: Record<string, unknown>) {
    if (sending) return
    setSending(true)
    setError(null)
    setResult(null)
    setActiveAgent(agentType)
    setActiveStatus('pending')
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, input }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : t('common.requestFailed'))
        setSending(false)
        setActiveStatus(null)
        return
      }
      const task = body?.data
      const status = task?.status as string | undefined
      if (status === 'completed' || status === 'failed' || status === 'terminated') {
        if (status === 'completed') {
          setResult(typeof task?.result === 'string' ? task.result : JSON.stringify(task?.result ?? ''))
        } else {
          setError(typeof body?.error === 'string' ? body.error : t(`status.${status}`))
        }
        setActiveStatus(status)
        setSending(false)
        history.retry()
        return
      }
      const taskId = task?.taskId as string | undefined
      if (!taskId) {
        setError(t('common.requestFailed'))
        setSending(false)
        return
      }
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/agent/progress?taskId=${encodeURIComponent(taskId)}`)
          const pb = await pr.json().catch(() => null)
          const pstatus = (pb?.data?.taskStatus ?? pb?.data?.status) as string | undefined
          if (!pstatus) return
          setActiveStatus(pstatus)
          if (['completed', 'failed', 'terminated', 'paused'].includes(pstatus)) {
            if (pollRef.current) clearInterval(pollRef.current)
            if (pstatus === 'completed') {
              setResult(typeof pb?.data?.result === 'string' ? pb.data.result : JSON.stringify(pb?.data?.result ?? ''))
            } else if (pstatus !== 'paused') {
              setError(typeof pb?.data?.error === 'string' ? pb.data.error : t(`status.${pstatus}`))
            }
            setSending(false)
            history.retry()
          }
        } catch {
          // 保留当前状态等待下一次轮询
        }
      }, 2000)
    } catch {
      setError(t('common.requestFailed'))
      setSending(false)
      setActiveStatus(null)
    }
  }

  const commands: CommandDef[] = [
    { key: t('nav.selection'), agentType: 'selection', input: () => ({ keyword: keyword.trim() }) },
    { key: t('nav.content'), agentType: 'content', input: () => ({ language: 'en', tone: 'friendly' }) },
    { key: t('nav.adOptimizer'), agentType: 'ad-optimizer', input: () => ({}) },
    { key: t('nav.customerService'), agentType: 'customer-service', input: () => ({}) },
    { key: t('nav.fulfillment'), agentType: 'fulfillment', input: () => ({ action: 'sync' }) },
  ]

  async function onFreeCommand(e: FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) return
    // 自由文本指令：按选品关键词执行，选品库为空时服务端返回 400 并提示
    await runCommand('selection', { keyword: keyword.trim() })
  }

  const logs = (history.data?.data ?? []).slice(0, 10)

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{t('mobile.command')}</h1>

      <Card>
        <form onSubmit={onFreeCommand} className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary dark:border-[#2A2D35] dark:text-white"
          />
          <button
            type="submit"
            disabled={sending}
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? t('mobile.sending') : t('common.confirm')}
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {commands.map((cmd) => (
            <button
              key={cmd.agentType}
              type="button"
              disabled={sending}
              onClick={() => void runCommand(cmd.agentType, cmd.input())}
              className="rounded-lg bg-gray-50 px-3 py-2.5 text-left text-xs font-medium text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#22252D] dark:text-white dark:hover:bg-[#2A2D35]"
            >
              {cmd.key}
            </button>
          ))}
        </div>

        {activeAgent && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
            <div className="min-w-0">
              <p className="truncate text-sm text-gray-900 dark:text-white">{activeAgent}</p>
              {sending && <p className="text-xs text-gray-400 dark:text-[#6B7080]">{t('mobile.generating')}</p>}
            </div>
            {activeStatus && activeStatus !== 'pending' ? (
              <StatusBadge status={activeStatus} label={t(`status.${activeStatus}`)} />
            ) : (
              <StatusBadge status="pending" label={t('status.pending')} />
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {result && (
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-[#22252D] dark:text-gray-300">
            {result}
          </pre>
        )}
      </Card>

      <Card title={t('mobile.commandHistory')}>
        <MobileApiState state={history.state} error={history.error} onRetry={history.retry} emptyTitle={t('mobile.historyEmpty')} emptyHint={t('mobile.historyHint')} />
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.taskId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900 dark:text-white">{l.taskName}</p>
                <p className="text-xs text-gray-400 dark:text-[#6B7080]">{l.agentType} · {l.createdAt?.slice(0, 10) ?? ''}</p>
              </div>
              <StatusBadge status={l.status} label={t(`status.${l.status}`)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
