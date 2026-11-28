/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { useApi } from '@/lib/hooks/use-api'

describe('useApi 五态数据层（P4-01）', () => {
  test('loading → success：拿到非空数据', async () => {
    const { result } = renderHook(() => useApi(async () => ({ ok: 1 }), {}))
    expect(result.current.state).toBe('loading')
    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.data).toEqual({ ok: 1 })
    expect(result.current.error).toBeNull()
  })

  test('空数组判定为 empty', async () => {
    const { result } = renderHook(() => useApi(async () => [] as string[], {}))
    await waitFor(() => expect(result.current.state).toBe('empty'))
    expect(result.current.data).toEqual([])
  })

  test('null 数据判定为 empty', async () => {
    const { result } = renderHook(() => useApi(async () => null, {}))
    await waitFor(() => expect(result.current.state).toBe('empty'))
  })

  test('loader 抛错 → error 且带消息', async () => {
    const { result } = renderHook(() =>
      useApi(async () => {
        throw new Error('boom')
      })
    )
    await waitFor(() => expect(result.current.state).toBe('error'))
    expect(result.current.error).toBe('boom')
  })

  test('超时 → timeout（默认 30s 不触发，短超时触发）', async () => {
    const { result } = renderHook(() =>
      useApi(
        () => new Promise(() => {}),
        { timeoutMs: 40 }
      )
    )
    await waitFor(() => expect(result.current.state).toBe('timeout'), { timeout: 2000 })
    expect(result.current.error).toBe('请求超时')
  })

  test('timeoutMs=0 表示不启用超时', async () => {
    let resolved = false
    const { result } = renderHook(() =>
      useApi(
        async () => {
          await new Promise((r) => setTimeout(r, 60))
          resolved = true
          return 'done'
        },
        { timeoutMs: 0 }
      )
    )
    await waitFor(() => expect(result.current.state).toBe('success'), { timeout: 2000 })
    expect(resolved).toBe(true)
  })

  test('retry()：失败后重发成功', async () => {
    let calls = 0
    const { result } = renderHook(() =>
      useApi(async () => {
        calls += 1
        if (calls === 1) throw new Error('first fails')
        return 'second'
      })
    )
    await waitFor(() => expect(result.current.state).toBe('error'))
    await waitFor(() => {
      result.current.retry()
    })
    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.data).toBe('second')
    expect(calls).toBe(2)
  })

  test('自定义 isEmpty 生效', async () => {
    const { result } = renderHook(() =>
      useApi(async () => ({ items: [] }), { isEmpty: (d) => d.items.length === 0 })
    )
    await waitFor(() => expect(result.current.state).toBe('empty'))
  })

  test('auto=false 不自动请求，需手动 retry()', async () => {
    let calls = 0
    const { result } = renderHook(() =>
      useApi(async () => {
        calls += 1
        return 'x'
      }, { auto: false })
    )
    expect(result.current.state).toBe('idle')
    expect(calls).toBe(0)
    result.current.retry()
    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(calls).toBe(1)
  })
})
