'use client'

interface AIProgressStep {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface AIProgressProps {
  steps: AIProgressStep[]
  currentStep?: number
}

const STATUS_BG: Record<string, string> = {
  pending: 'bg-[#86909C] dark:bg-[#6B7080]',
  running: '',
  completed: 'bg-[#00B42A]',
  failed: 'bg-[#F53F3F]',
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'text-[#86909C] dark:text-[#6B7080]',
  running: 'text-primary font-medium',
  completed: 'text-[#1D2129] dark:text-[#E8EAED]',
  failed: 'text-[#F53F3F]',
}

function StepIcon({ status }: { status: AIProgressStep['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'failed':
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    case 'running':
      return <span className="w-2 h-2 rounded-full bg-white" />
    default:
      return <span className="w-2 h-2 rounded-full bg-white/60" />
  }
}

export default function AIProgress({ steps, currentStep }: AIProgressProps) {
  return (
    <div className="flex items-start w-full">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const isCompleted = step.status === 'completed'
        const isRunning = step.status === 'running'
        const isFailed = step.status === 'failed'
        const isCurrent = currentStep !== undefined ? index === currentStep : isRunning

        const dotStyle: React.CSSProperties = {}
        if (isRunning) {
          dotStyle.background = 'linear-gradient(135deg, #1677FF, #722ED1)'
          dotStyle.animation = 'gradient-flow 2s ease infinite'
          dotStyle.backgroundSize = '200% 200%'
        } else if (isCompleted) {
          dotStyle.background = '#00B42A'
        } else if (isFailed) {
          dotStyle.background = '#F53F3F'
        }

        const lineStyle: React.CSSProperties = {}
        if (isCompleted || (isRunning && index > 0)) {
          lineStyle.background = 'linear-gradient(90deg, #722ED1, #1677FF)'
        }

        return (
          <div key={index} className={`flex flex-col items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex items-center w-full">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !isCompleted && !isRunning && !isFailed ? STATUS_BG[step.status] : ''
                } ${isCurrent ? 'animate-pulse' : ''}`}
                style={dotStyle}
              >
                <StepIcon status={step.status} />
              </div>
              {!isLast && (
                <div
                  className="flex-1 h-0.5 mx-1 rounded-full"
                  style={lineStyle}
                />
              )}
            </div>
            <span className={`mt-2 text-xs whitespace-nowrap ${STATUS_TEXT[step.status]}`}>
              {step.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
