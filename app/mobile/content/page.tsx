'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'
import { useTranslation } from '@/lib/i18n/use-translation'
import { useApi } from '@/lib/hooks/use-api'
import { getJson } from '@/lib/api/get-json'
import MobileApiState from '@/components/MobileApiState'
import { Card, StatusBadge } from '@/components/MobileCard'

interface MobileProduct {
  id: number
  name: string
  category: string | null
  price: number | null
  sales: number
}

interface TaskLog {
  taskId: string
  agentType: string
  taskName: string
  status: string
  createdAt: string
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
]
const TONES = ['friendly', 'professional', 'promotional']

export default function MobileContentPage() {
  const { t } = useTranslation()
  const products = useApi(() => getJson<MobileProduct[]>('/api/data?type=products'))
  const history = useApi(() => getJson<{ data: TaskLog[] }>('/api/task-logs?limit=20'))

  const topProducts = [...(products.data ?? [])].sort((a, b) => b.sales - a.sales)
  const [productId, setProductId] = useState<number | ''>('')
  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('friendly')
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function onGenerate(e: FormEvent) {
    e.preventDefault()
    if (generating) return
    setError(null)
    setResult(null)
    setGenerating(true)
    try {
      const input: Record<string, unknown> = { language, tone }
      if (productId !== '') input.productId = productId
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType: 'content', input }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : t('common.requestFailed'))
        setGenerating(false)
        return
      }
      const task = body?.data
      const status = task?.status as string | undefined
      if (status === 'completed') {
        setResult(typeof task?.result === 'string' ? task.result : JSON.stringify(task?.result ?? ''))
        setGenerating(false)
        history.retry()
        return
      }
      if (status === 'failed') {
        setError(typeof body?.error === 'string' ? body.error : t('status.failed'))
        setGenerating(false)
        return
      }
      const taskId = task?.taskId as string | undefined
      if (!taskId) {
        setError(t('common.requestFailed'))
        setGenerating(false)
        return
      }
      // Queue mode: poll progress until it reaches a terminal state
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/agent/progress?taskId=${encodeURIComponent(taskId)}`)
          const pb = await pr.json().catch(() => null)
          const pstatus = (pb?.data?.taskStatus ?? pb?.data?.status) as string | undefined
          if (pstatus && ['completed', 'failed', 'terminated', 'paused'].includes(pstatus)) {
            if (pollRef.current) clearInterval(pollRef.current)
            if (pstatus === 'completed') {
              setResult(typeof pb?.data?.result === 'string' ? pb.data.result : JSON.stringify(pb?.data?.result ?? ''))
            } else {
              setError(typeof pb?.data?.error === 'string' ? pb.data.error : t(`status.${pstatus}`))
            }
            setGenerating(false)
            history.retry()
          }
        } catch {
          // On poll failure keep the current state and wait for the next attempt
        }
      }, 2000)
    } catch {
      setError(t('common.requestFailed'))
      setGenerating(false)
    }
  }

  const contentLogs = (history.data?.data ?? []).filter((l) => l.agentType === 'content').slice(0, 5)

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('nav.content')}</h1>

      <Card title={t('mobile.copyProduct')}>
        <MobileApiState state={products.state} error={products.error} onRetry={products.retry} emptyTitle={t('mobile.productsEmpty')} emptyHint={t('mobile.productsHint')} />
        <div className="space-y-2">
          {topProducts.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProductId(productId === p.id ? '' : p.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                productId === p.id
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'bg-gray-50 text-gray-900 dark:bg-[#22252D] dark:text-white'
              }`}
            >
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block text-xs text-gray-400 dark:text-[#6B7080]">{p.category ?? '—'}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <form onSubmit={onGenerate} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#8B91A0]">{t('mobile.copyLanguage')}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-900 dark:border-[#2A2D35] dark:bg-[#181A20] dark:text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-[#8B91A0]">{t('mobile.copyTone')}</span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2.5 text-sm text-gray-900 dark:border-[#2A2D35] dark:bg-[#181A20] dark:text-white"
            >
              {TONES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={generating || products.state === 'error'}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? t('mobile.generating') : t('mobile.generateCopy')}
          </button>
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      </Card>

      {result && (
        <Card title={t('mobile.generateCopy')}>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-[#22252D] dark:text-gray-300">
            {result}
          </pre>
        </Card>
      )}

      <Card title={t('mobile.commandHistory')}>
        <MobileApiState state={history.state} error={history.error} onRetry={history.retry} emptyTitle={t('mobile.copyEmpty')} emptyHint={t('mobile.historyHint')} />
        <div className="space-y-2">
          {contentLogs.map((l) => (
            <div key={l.taskId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-[#22252D]">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900 dark:text-white">{l.taskName}</p>
                <p className="text-xs text-gray-400 dark:text-[#6B7080]">{l.createdAt?.slice(0, 10) ?? ''}</p>
              </div>
              <StatusBadge status={l.status} label={t(`status.${l.status}`)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
