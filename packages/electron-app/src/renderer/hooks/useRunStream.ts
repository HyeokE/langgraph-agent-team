import { useState, useEffect, useCallback, useRef } from 'react'

export interface ChatMessageData {
  message: {
    id: string
    agentId: string
    agentName?: string
    content: string
    mentions: string[]
    replyTo?: string
    step: number
    timestamp: string
  }
}

export interface RunEvent {
  type: 'step' | 'route' | 'complete' | 'error' | 'message'
  timestamp: string
  data: unknown
}

export type RunStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled'

interface UseRunStreamReturn {
  sessionId: string | null
  status: RunStatus
  events: RunEvent[]
  chatMessages: ChatMessageData['message'][]
  startRun: (teamId: string, input: Record<string, unknown>) => Promise<void>
  cancelRun: () => Promise<void>
  clearEvents: () => void
}

/**
 * 팀 실행 스트림을 구독하고 실시간 이벤트를 관리하는 훅.
 * 컴포넌트 언마운트 시 IPC 리스너를 자동 정리합니다.
 */
export function useRunStream(): UseRunStreamReturn {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<RunStatus>('idle')
  const [events, setEvents] = useState<RunEvent[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessageData['message'][]>([])

  // 클린업 함수들을 ref로 보관 (리렌더링 영향 없음)
  const cleanupRef = useRef<Array<() => void>>([])

  const removeAllListeners = useCallback(() => {
    for (const cleanup of cleanupRef.current) {
      cleanup()
    }
    cleanupRef.current = []
  }, [])

  const appendEvent = useCallback((type: RunEvent['type'], data: unknown) => {
    setEvents((prev) => [
      ...prev,
      { type, timestamp: new Date().toISOString(), data }
    ])
  }, [])

  const startRun = useCallback(
    async (teamId: string, input: Record<string, unknown>) => {
      // 기존 리스너 정리
      removeAllListeners()

      setStatus('running')
      setEvents([])
      setChatMessages([])

      // IPC 이벤트 구독 설정
      const cleanups = [
        window.electronAPI.execution.onStep((data) => appendEvent('step', data)),
        window.electronAPI.execution.onRoute((data) => appendEvent('route', data)),
        window.electronAPI.execution.onComplete((data) => {
          appendEvent('complete', data)
          setStatus('completed')
          removeAllListeners()
        }),
        window.electronAPI.execution.onError((data) => {
          appendEvent('error', data)
          setStatus('error')
          removeAllListeners()
        }),
        window.electronAPI.execution.onMessage((data) => {
          appendEvent('message', data)
          const payload = data as ChatMessageData
          if (payload?.message) {
            setChatMessages((prev) => [...prev, payload.message])
          }
        })
      ]

      cleanupRef.current = cleanups

      try {
        const result = await window.electronAPI.execution.start(teamId, input)
        setSessionId(result.sessionId)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '실행 시작 중 오류가 발생했습니다.'
        appendEvent('error', { message })
        setStatus('error')
        setSessionId(null)
        removeAllListeners()
      }
    },
    [appendEvent, removeAllListeners]
  )

  const cancelRun = useCallback(async () => {
    if (!sessionId) return

    await window.electronAPI.execution.cancel(sessionId)
    setStatus('cancelled')
    removeAllListeners()
  }, [sessionId, removeAllListeners])

  const clearEvents = useCallback(() => {
    setEvents([])
    setChatMessages([])
  }, [])

  // 컴포넌트 언마운트 시 리스너 정리
  useEffect(() => {
    return () => {
      removeAllListeners()
    }
  }, [removeAllListeners])

  return { sessionId, status, events, chatMessages, startRun, cancelRun, clearEvents }
}
