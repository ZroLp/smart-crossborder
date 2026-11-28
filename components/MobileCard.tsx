'use client';

import { ReactNode } from 'react';

export function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-[#181A20]">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center dark:border-[#2A2D35]">
      <p className="text-sm text-gray-600 dark:text-gray-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-[#6B7080]">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  running: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  pending: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    BADGE_TONES[status] ?? 'bg-gray-500/15 text-gray-500 dark:text-[#8B91A0]';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

const RISK_TONES: Record<string, string> = {
  high: 'bg-red-500/15 text-red-600 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

export function RiskBadge({ level }: { level: string }) {
  const tone = RISK_TONES[level] ?? RISK_TONES.low;
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}
