'use client'

import { useState, useCallback } from 'react'
import AIStepProgress from '@/components/AIStepProgress'
import { useAgentTask } from '@/hooks/useAgentTask'
import { useTranslation } from '@/lib/i18n/use-translation'

interface ContentItem {
  id: string
  title: string
  description: string
  language: string
  type: string
  createdAt: string
}

export default function ContentPage() {
  const { t } = useTranslation()
  const [language, setLanguage] = useState('en')
  const [product, setProduct] = useState('')
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  const fetchContent = useCallback(async () => {
    try {
      setIsLoadingContent(true)
      const res = await fetch('/api/data?type=task-logs&agentType=content&limit=50')
      const data = await res.json()
      if (data.success && data.data) {
        setGeneratedContent(
          data.data.map((c: any, i: number) => ({
            id: c.id || `content-${i}`,
            title: c.title || c.name || `${t('contentStudio.titleFallback')}${i + 1}`,
            description: c.description || c.desc || c.content || '',
            language: c.language || language,
            type: c.type || t('contentStudio.typeFallback'),
            createdAt: c.createdAt || new Date().toISOString(),
          }))
        )
      } else {
        setGeneratedContent([])
      }
    } catch {
      setGeneratedContent([])
    } finally {
      setIsLoadingContent(false)
    }
  }, [language, t])

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
    agentType: 'content',
    onTerminal: (status) => {
      if (status === 'completed') {
        void fetchContent()
      }
    },
  })

  const handleSubmit = async (type?: string) => {
    if (!product) return
    const input: Record<string, unknown> = { language, productId: product }
    if (type) input.type = type
    await submit(input)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{t('contentStudio.title')}</h2>

      {error && !isActive && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={clearError}
            className="text-danger/70 hover:text-danger text-lg leading-none"
            aria-label={t('common.closeError')}
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('contentStudio.targetLang')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="en">English</option>
              <option value="ja">{t('contentStudio.langJa')}</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{t('contentStudio.productSelect')}</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="border border-gray-200 dark:border-[#2A2D35] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary dark:text-[#E8EAED]"
            >
              <option value="">{t('contentStudio.pleaseSelect')}</option>
              <option value="1">{t('contentStudio.productEarbuds')}</option>
              <option value="2">{t('contentStudio.productWatch')}</option>
              <option value="3">{t('contentStudio.productPowerBank')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6 min-h-[300px]">
        <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mb-4">{t('contentStudio.preview')}</p>
        {isLoadingContent ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-[#2A2D35] rounded w-3/4"></div>
            <div className="h-3 bg-gray-100 dark:bg-[#22252D] rounded w-full"></div>
            <div className="h-3 bg-gray-100 dark:bg-[#22252D] rounded w-5/6"></div>
          </div>
        ) : generatedContent.length === 0 ? (
          <div className="border border-dashed border-gray-200 dark:border-[#2A2D35] rounded-lg p-8 text-center text-gray-400 dark:text-[#6B7080] text-sm">
            {t('contentStudio.empty')}
          </div>
        ) : (
          <div className="space-y-4">
            {generatedContent.slice(0, 5).map((item) => (
              <div key={item.id} className="border border-gray-100 dark:border-[#2A2D35] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-[#1D2129] dark:text-[#E8EAED] text-sm">{item.title}</h4>
                  <div className="flex gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {item.language}
                    </span>
                    <span className="text-xs bg-gray-100 dark:bg-[#22252D] text-[#4E5969] dark:text-[#A0A4AC] px-2 py-0.5 rounded-full">
                      {item.type}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit()}
          disabled={submitting || !product}
          className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t('mobile.generating') : t('mobile.generateCopy')}
        </button>
        <button
          onClick={() => handleSubmit('materials')}
          disabled={submitting || !product}
          className="bg-purple text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('dashboard.generateAssets')}
        </button>
        <button
          onClick={() => handleSubmit('batch-update')}
          disabled={submitting || !product}
          className="bg-teal text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('contentStudio.batchUpdate')}
        </button>
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
