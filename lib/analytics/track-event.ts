'use client'

/**
 * P5-02 client-side event tracking (fire-and-forget).
 *
 * - source attribution: UTM params (utm_source) read from the entry URL,
 *   falling back to the first-party referrer host. Persisted so later
 *   events in the same visit keep the original channel.
 * - sessionId: stable per browser session (sessionStorage).
 */

export type TrackedEvent = 'signup' | 'shop_connected' | 'task_submitted' | 'task_completed'

const SESSION_KEY = 'sumaitong:analytics-session'
const SOURCE_KEY = 'sumaitong:analytics-source'

function readUtmSource(): string | null {
  if (typeof window === 'undefined') return null
  const utm = new URLSearchParams(window.location.search).get('utm_source')
  if (utm) return `utm:${utm}`
  const ref = document.referrer
  if (ref && !ref.includes(window.location.host)) {
    try {
      return `ref:${new URL(ref).host}`
    } catch {
      return null
    }
  }
  return null
}

function resolveSource(): string | null {
  if (typeof window === 'undefined') return null
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(SOURCE_KEY)
  } catch {
    /* storage unavailable */
  }
  if (stored) return stored
  const fresh = readUtmSource()
  if (fresh) {
    try {
      sessionStorage.setItem(SOURCE_KEY, fresh)
    } catch {
      /* ignore */
    }
    return fresh
  }
  return null
}

function resolveSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export function trackEvent(
  eventName: TrackedEvent,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  const source = resolveSource()
  const sessionId = resolveSessionId()
  void fetch('/api/analytics/track', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      properties,
      source,
      sessionId: sessionId || undefined,
    }),
  }).catch(() => {
    /* telemetry must never break the main flow */
  })
}
