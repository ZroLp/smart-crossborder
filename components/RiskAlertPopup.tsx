'use client'

import { useState, useEffect } from 'react'

interface RiskAlert {
  id: string
  type: string
  title: string
  message: string
  link?: string
}

interface RiskAlertPopupProps {
  alerts: RiskAlert[]
  onClose: (id: string) => void
  onJump: (link: string) => void
}

export default function RiskAlertPopup({ alerts, onClose, onJump }: RiskAlertPopupProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (alerts.length > 0) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [alerts.length])

  if (alerts.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => alerts.forEach((a) => onClose(a.id))}
      />
      <div
        className={`relative w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-2xl shadow-2xl p-6 space-y-4 transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
        }`}
        style={{
          background: 'linear-gradient(135deg, #FF7D00, #F53F3F)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white text-lg font-bold">⚠️ 风险预警</h3>
          <span className="text-white/80 text-sm">{alerts.length} 条预警</span>
        </div>

        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold text-sm">{alert.title}</h4>
                <p className="text-white/90 text-sm mt-1">{alert.message}</p>
                <div className="flex items-center gap-3 mt-3">
                  {alert.link && (
                    <button
                      onClick={() => onJump(alert.link!)}
                      className="bg-white text-[#F53F3F] px-3 py-1 rounded-lg text-xs font-medium hover:bg-white/90 transition-colors"
                    >
                      查看详情
                    </button>
                  )}
                  <button
                    onClick={() => onClose(alert.id)}
                    className="text-white/80 hover:text-white text-xs transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { RiskAlert, RiskAlertPopupProps }
