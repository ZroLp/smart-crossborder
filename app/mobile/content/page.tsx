'use client'

import { useState } from 'react'
import Link from 'next/link'

const templates = [
  { name: '简约白底', icon: '⬜', color: 'bg-gray-100 dark:bg-[#22252D]' },
  { name: '渐变风格', icon: '🌈', color: 'bg-primary/10' },
  { name: '场景展示', icon: '🖼️', color: 'bg-purple/10' },
  { name: '促销标签', icon: '🏷️', color: 'bg-warning/10' },
]

export default function MobileContentPage() {
  const [language, setLanguage] = useState('en')
  const [inputText, setInputText] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/mobile" className="text-gray-400 dark:text-[#6B7080]">
          ← 返回
        </Link>
        <h1 className="text-lg font-semibold text-gray-600">素材创作</h1>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">文案生成</h2>
        <div className="mb-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入商品信息或描述..."
            className="w-full bg-gray-50 dark:bg-[#22252D] rounded-xl px-4 py-3 text-sm text-gray-600 outline-none resize-none h-24"
          ></textarea>
        </div>
        <div className="flex gap-3 mb-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 bg-gray-50 dark:bg-[#22252D] rounded-xl px-3 py-2.5 text-sm text-gray-600 outline-none"
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
          <button
            onClick={() => {
              if (!inputText.trim()) return;
              setInputText('AI 文案生成中...');
            }}
            className="bg-primary text-white px-5 rounded-xl text-sm font-medium"
          >
            生成文案
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">图片模板</h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template, index) => (
            <button
              key={template.name}
              onClick={() => setSelectedTemplate(index)}
              className={`${template.color} rounded-xl p-4 flex flex-col items-center gap-2 ${
                selectedTemplate === index ? 'ring-2 ring-primary' : ''
              }`}
            >
              <span className="text-2xl">{template.icon}</span>
              <span className="text-xs text-gray-500 dark:text-[#A0A4AC] font-medium">{template.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">内容预览</h2>
        <div className="bg-gray-50 dark:bg-[#22252D] rounded-xl p-6 text-center">
          <div className="w-32 h-32 bg-gray-200 rounded-xl mx-auto mb-3 flex items-center justify-center">
            <span className="text-3xl">🖼️</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-[#6B7080]">生成的素材将在此处预览</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            if (!inputText.trim() && selectedTemplate === null) return
            const draft = {
              text: inputText,
              template: templates[selectedTemplate ?? 0]?.name ?? '无',
              language,
              timestamp: new Date().toISOString(),
            }
            try {
              localStorage.setItem('content-draft', JSON.stringify(draft))
            } catch {}
          }}
          className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-medium"
        >
          保存草稿
        </button>
        <button
          onClick={() => {
            const blob = new Blob(['素材内容'], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'ai-material.txt'; a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex-1 bg-success text-white py-3 rounded-xl text-sm font-medium"
        >
          下载素材
        </button>
      </div>
    </div>
  )
}
