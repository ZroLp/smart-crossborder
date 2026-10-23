'use client'

interface SkeletonLoaderProps {
  width?: string
  height?: string
  className?: string
  variant?: 'text' | 'card' | 'circle' | 'image'
}

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-primary) 25%, var(--border-color) 50%, var(--bg-primary) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
}

const variantClasses: Record<string, string> = {
  text: 'h-4 rounded-md',
  card: 'rounded-xl',
  circle: 'rounded-full',
  image: 'rounded-lg',
}

const defaultSizes: Record<string, { width: string; height: string }> = {
  text: { width: '100%', height: '16px' },
  card: { width: '100%', height: '120px' },
  circle: { width: '48px', height: '48px' },
  image: { width: '100%', height: '160px' },
}

export default function SkeletonLoader({ width, height, className = '', variant = 'text' }: SkeletonLoaderProps) {
  const finalWidth = width || defaultSizes[variant].width
  const finalHeight = height || defaultSizes[variant].height

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      style={{
        width: finalWidth,
        height: finalHeight,
        ...shimmerStyle,
      }}
    />
  )
}
