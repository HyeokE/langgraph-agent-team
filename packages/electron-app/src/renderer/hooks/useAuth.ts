import { useState, useEffect, useCallback } from 'react'

export interface AuthStatus {
  authenticated: boolean
  proxyRunning: boolean
  hasValidToken: boolean
  tokenEmail?: string
  tokenExpired?: string
}

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await window.electronAPI.auth.getStatus()
      setStatus(s)
    } catch {
      setStatus({ authenticated: false, proxyRunning: false, hasValidToken: false })
    }
  }, [])

  useEffect(() => {
    void refresh()
    // 30초마다 상태 갱신
    const interval = setInterval(() => void refresh(), 30_000)

    // setup:status 이벤트로 프록시 ready 즉시 반영
    const unsub = window.electronAPI.setup.onStatus((s) => {
      const status = s as { stage: string }
      if (status?.stage === 'ready' || status?.stage === 'error') {
        void refresh()
      }
    })

    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [refresh])

  const login = useCallback(async () => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      await window.electronAPI.auth.login()
      // 로그인 후 약간 대기 후 상태 갱신 (프록시 재시작 시간)
      await new Promise((r) => setTimeout(r, 2000))
      await refresh()
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoginLoading(false)
    }
  }, [refresh])

  return { status, loginLoading, loginError, login, refresh }
}
