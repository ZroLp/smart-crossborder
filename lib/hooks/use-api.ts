'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useApi —— P4-01 五态统一数据层。
 *
 * 所有前端页面取数统一走这个 hook，状态机：
 *   loading → success | empty | error | timeout
 *
 * - `loading`：请求进行中（含首次加载与 `retry()` 重发）
 * - `success`：拿到数据且非空
 * - `empty`：拿到数据但为空（数组长度 0 / null / undefined），由 `isEmpty` 判定
 * - `error`：HTTP 非 2xx、loader 抛错、或解析失败
 * - `timeout`：超过 `timeoutMs` 未完成（默认 30s），abort 后进入本态
 *
 * 语义约定：
 * - loader 返回 `undefined`/`null` 视为 empty 而不是 error（调用方负责把
 *   HTTP 错误抛出去）。
 * - 超时用 Promise.race 实现（即使 loader 永不 settle 也能进入 timeout 态）。
 */
export type ApiState = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'timeout'

export interface UseApiOptions<T> {
  /** 请求超时（毫秒），默认 30000。传入 0 表示不启用超时。 */
  timeoutMs?: number
  /** 自定义空判定；默认：null/undefined 或空数组。 */
  isEmpty?: (data: T) => boolean
  /** 数据变化（含 deps）时自动重新拉取；默认 true。 */
  auto?: boolean
}

export interface UseApiResult<T> {
  state: ApiState
  data: T | null
  error: string | null
  /** 重新发起一次请求（幂等；进行中则忽略）。 */
  retry: () => void
}

function defaultIsEmpty<T>(data: T | null | undefined): boolean {
  if (data === null || data === undefined) return true
  if (Array.isArray(data)) return data.length === 0
  return false
}

export function useApi<T>(loader: () => Promise<T> | T, options: UseApiOptions<T> = {}): UseApiResult<T> {
  const { timeoutMs = 30000, isEmpty = defaultIsEmpty, auto = true } = options
  const [state, setState] = useState<ApiState>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const isEmptyRef = useRef(isEmpty)
  isEmptyRef.current = isEmpty
  const runningRef = useRef(false)

  const load = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setState('loading')
    setError(null)

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise: Promise<never> | null =
      timeoutMs > 0
        ? new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('__use-api-timeout__')), timeoutMs)
          })
        : null

    try {
      const pending = Promise.resolve(loaderRef.current())
      const result = timeoutPromise ? await Promise.race([pending, timeoutPromise]) : await pending
      if (timer) clearTimeout(timer)
      setData(result ?? null)
      setState(result == null || isEmptyRef.current(result) ? 'empty' : 'success')
    } catch (err) {
      if (timer) clearTimeout(timer)
      setData(null)
      if (err instanceof Error && err.message === '__use-api-timeout__') {
        setError('请求超时')
        setState('timeout')
      } else {
        setError(err instanceof Error ? err.message : String(err))
        setState('error')
      }
    } finally {
      runningRef.current = false
    }
  }, [timeoutMs])

  useEffect(() => {
    if (!auto) return
    runningRef.current = false
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, load])

  return { state, data, error, retry: load }
}
