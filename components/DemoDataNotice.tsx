interface DemoDataNoticeProps {
  children: React.ReactNode
}

export default function DemoDataNotice({ children }: DemoDataNoticeProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-[#4E5969] dark:text-[#A0A4AC]"
    >
      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        演示数据
      </span>
      <span>{children}</span>
    </div>
  )
}
