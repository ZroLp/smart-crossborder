'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSpeechService, SpeechLanguage } from '@/lib/speech/web-speech'

interface VoiceInputButtonProps {
  onResult: (text: string) => void
  language?: SpeechLanguage
  disabled?: boolean
}

type VoiceState = 'idle' | 'listening' | 'processing'

export default function VoiceInputButton({ onResult, language = 'zh-CN', disabled = false }: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [interimText, setInterimText] = useState('')
  const [supported, setSupported] = useState(true)
  const speechService = useRef(getSpeechService())

  useEffect(() => {
    setSupported(speechService.current.isSupported())
  }, [])

  const handleClick = useCallback(() => {
    if (disabled) return

    if (state === 'listening') {
      speechService.current.stopRecognition()
      setState('processing')
      return
    }

    if (state === 'processing') return

    setInterimText('')

    const eventSubscription = speechService.current.subscribe((event) => {
      switch (event.type) {
        case 'start':
          setState('listening')
          break
        case 'interim':
          if (event.interimTranscript) {
            setInterimText(event.interimTranscript)
          }
          break
        case 'final':
          if (event.transcript) {
            onResult(event.transcript)
            setInterimText('')
          }
          break
        case 'end':
          setState('idle')
          setInterimText('')
          break
        case 'error':
          setState('idle')
          setInterimText('')
          break
      }
    })

    const subscription = speechService.current.startRecognition(language)

    return () => {
      eventSubscription.unsubscribe()
      subscription.unsubscribe()
    }
  }, [state, language, disabled, onResult])

  useEffect(() => {
    return () => {
      speechService.current.stopRecognition()
    }
  }, [])

  if (!supported) return null

  const buttonClasses = [
    'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200',
    state === 'idle' && !disabled
      ? 'bg-gray-100 dark:bg-[#22252D] text-gray-400 dark:text-[#6B7080] active:bg-gray-200 dark:active:bg-[#2A2D35]'
      : '',
    state === 'listening'
      ? 'bg-red-500 text-white voice-pulse'
      : '',
    state === 'processing'
      ? 'bg-gray-100 dark:bg-[#22252D] text-gray-400 dark:text-[#6B7080]'
      : '',
    disabled
      ? 'bg-gray-50 dark:bg-[#22252D] text-gray-300 dark:text-[#6B7080] cursor-not-allowed'
      : 'cursor-pointer',
  ].filter(Boolean).join(' ')

  return (
    <div className="relative flex items-center">
      <style>{`
        @keyframes voice-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .voice-pulse {
          position: relative;
        }
        .voice-pulse::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          background: rgba(239, 68, 68, 0.3);
          animation: voice-pulse-ring 1.2s ease-out infinite;
          z-index: -1;
        }
      `}</style>

      {state === 'listening' && interimText && (
        <div className="absolute bottom-full mb-2 right-0 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis shadow-lg">
          {interimText}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === 'processing'}
        className={buttonClasses}
        aria-label={state === 'listening' ? '停止录音' : '开始语音输入'}
      >
        {state === 'processing' ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
