import { createContext, useContext } from 'react'

interface OfflineContextValue {
  isOnline: boolean
  wasOffline: boolean
  acknowledgeReconnect: () => void
}

export const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  wasOffline: false,
  acknowledgeReconnect: () => {},
})

export function useOfflineContext() {
  return useContext(OfflineContext)
}
