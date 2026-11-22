'use client';

import { ApiState } from '@/lib/hooks/use-api';
import { useTranslation } from '@/lib/i18n/use-translation';

interface MobileApiStateProps {
  state: ApiState;
  error?: string | null;
  emptyTitle?: string;
  emptyHint?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
  /** 加载骨架行数，默认 3 */
  skeletonRows?: number;
}

/**
 * 移动端统一五态视图：loading 骨架 / error / timeout / empty / success(隐藏)。
 * 保证页面不渲染任何假数据。
 */
export default function MobileApiState({
  state,
  error,
  emptyTitle,
  emptyHint,
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  skeletonRows = 3,
}: MobileApiStateProps) {
  const { t } = useTranslation();

  if (state === 'success') return null;

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="space-y-3" role="status" aria-label={t('common.loading')}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            className="h-16 bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-4 animate-pulse"
          >
            <div className="h-4 w-2/3 bg-gray-100 dark:bg-[#2A2D35] rounded" />
            <div className="h-3 w-1/2 bg-gray-50 dark:bg-[#22252D] rounded mt-3" />
          </div>
        ))}
      </div>
    );
  }

  if (state === 'error' || state === 'timeout') {
    return (
      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-5 text-center" role="alert">
        <p className="text-sm font-medium text-danger mb-1">
          {state === 'timeout' ? t('common.requestTimeout') : t('common.requestFailed')}
        </p>
        {error && <p className="text-xs text-gray-400 dark:text-[#6B7080] mb-3 break-all">{error}</p>}
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-medium"
          >
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  // empty
  return (
    <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-8 text-center" role="status">
      <p className="text-3xl mb-2" aria-hidden="true">📭</p>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{emptyTitle ?? t('common.noData')}</p>
      {emptyHint && (
        <p className="text-xs text-gray-400 dark:text-[#6B7080] mt-1">{emptyHint}</p>
      )}
      {emptyActionLabel && onEmptyAction && (
        <button
          onClick={onEmptyAction}
          className="mt-4 text-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-medium"
        >
          {emptyActionLabel}
        </button>
      )}
    </div>
  );
}
