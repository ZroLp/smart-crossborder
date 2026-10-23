'use client'

interface AIBadgeProps {
  label?: string
  variant?: 'default' | 'glow' | 'subtle'
  className?: string
}

export default function AIBadge({ label = 'AI', variant = 'default', className = '' }: AIBadgeProps) {
  const variantClasses: Record<string, string> = {
    default: 'bg-[#722ED1] text-white',
    glow: 'bg-[#722ED1] text-white',
    subtle: 'bg-[#F5F0FF] dark:bg-[#2A1F4E] text-[#722ED1]',
  }

  const variantStyles: Record<string, React.CSSProperties | undefined> = {
    default: undefined,
    glow: { animation: 'ai-glow 2s ease-in-out infinite' },
    subtle: undefined,
  }

  return (
    <span
      className={`inline-flex items-center text-caption px-2 py-0.5 rounded-full font-medium ${variantClasses[variant]} ${className}`}
      style={variantStyles[variant]}
    >
      {label}
    </span>
  )
}
