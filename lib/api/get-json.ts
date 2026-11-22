/**
 * 移动端页面取数辅助：统一 fetch + 错误语义（HTTP 非 2xx 时抛出服务端 error 或状态码）。
 */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let message: string | null = null
    try {
      const body = (await res.json()) as { error?: unknown }
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      // 响应体不是 JSON 时忽略
    }
    throw new Error(message ?? `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const err = (body as { error?: unknown } | null)?.error
    throw new Error(typeof err === 'string' ? err : `HTTP ${res.status}`)
  }
  return body as T
}

/** 解包 { success, data } 响应，返回内层 data。 */
export async function getJsonData<D>(url: string): Promise<D> {
  const body = await getJson<{ success?: boolean; data?: D }>(url)
  return (body?.data ?? null) as D
}
