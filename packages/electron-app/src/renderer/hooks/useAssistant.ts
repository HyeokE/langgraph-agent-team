import { useState, useCallback, useRef } from 'react'
import type { AssistantContext, ChatMessage, AssistantAction } from '../../main/types/assistantTypes'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  action?: AssistantAction
  actionResult?: string
}

export function useAssistant(context: AssistantContext) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentRequestId = useRef<string | null>(null)
  const cleanupFns = useRef<Array<() => void>>([])

  const send = useCallback(
    async (content: string) => {
      if (loading) return

      const userMessage: AssistantMessage = { role: 'user', content }
      setMessages((prev) => [...prev, userMessage])
      setLoading(true)
      setError(null)

      // history는 이전 메시지 (사용자 메시지 추가 전 상태)
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content
      }))

      try {
        const { requestId } = await window.electronAPI.assistant.send(
          content,
          context,
          history
        )
        currentRequestId.current = requestId

        // 이벤트 리스너 등록
        const unsubResponse = window.electronAPI.assistant.onResponse((data) => {
          const { message } = data as { message: string }
          setMessages((prev) => {
            // 기존 어시스턴트 응답이 있으면 업데이트, 없으면 추가
            const lastIdx = prev.findLastIndex((m) => m.role === 'assistant')
            if (lastIdx >= 0 && prev[lastIdx]) {
              const updated = [...prev]
              updated[lastIdx] = { ...updated[lastIdx]!, content: message }
              return updated
            }
            return [...prev, { role: 'assistant', content: message }]
          })
          setLoading(false)
        })

        const unsubAction = window.electronAPI.assistant.onAction((data) => {
          const { action, result } = data as { action: AssistantAction; result: string }
          setMessages((prev) => {
            const lastIdx = prev.findLastIndex((m) => m.role === 'assistant')
            if (lastIdx >= 0 && prev[lastIdx]) {
              const updated = [...prev]
              updated[lastIdx] = { ...updated[lastIdx]!, action, actionResult: result }
              return updated
            }
            return [...prev, { role: 'assistant', content: '', action, actionResult: result }]
          })
        })

        const unsubError = window.electronAPI.assistant.onError((data) => {
          const { error: errMsg } = data as { error: string }
          setError(errMsg)
          setLoading(false)
        })

        cleanupFns.current = [unsubResponse, unsubAction, unsubError]
      } catch (err) {
        setError(err instanceof Error ? err.message : '요청 실패')
        setLoading(false)
      }
    },
    [loading, messages, context]
  )

  const cancel = useCallback(async () => {
    if (currentRequestId.current) {
      await window.electronAPI.assistant.cancel(currentRequestId.current)
      currentRequestId.current = null
    }
    cleanupFns.current.forEach((fn) => fn())
    cleanupFns.current = []
    setLoading(false)
  }, [])

  const clearHistory = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, loading, error, send, cancel, clearHistory }
}
