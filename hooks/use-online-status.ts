'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseOnlineStatusResult {
  isOnline: boolean
  wasOffline: boolean
  acknowledgeReconnect: () => void
}

export function useOnlineStatus(): UseOnlineStatusResult {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  const wasOnlineRef = useRef(true)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    if (!wasOnlineRef.current) {
      setWasOffline(true)
    }
    wasOnlineRef.current = true
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    wasOnlineRef.current = false
  }, [])

  const acknowledgeReconnect = useCallback(() => {
    setWasOffline(false)
  }, [])

  useEffect(() => {
    wasOnlineRef.current = navigator.onLine
    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return { isOnline, wasOffline, acknowledgeReconnect }
}
