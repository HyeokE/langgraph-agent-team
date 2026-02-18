import { createContext, useContext, useState, useCallback } from 'react'
import type { AssistantContext } from '../../main/types/assistantTypes'

const DEFAULT_CONTEXT: AssistantContext = {
  toolLibrary: [],
  availableEnvKeys: []
}

interface AssistantStateValue {
  isOpen: boolean
  context: AssistantContext
  /** 패널이 열릴 때 자동 전송될 메시지 */
  pendingMessage: string | null
  /** 페이지에서 컨텍스트와 함께 어시스턴트를 열기 */
  openWithContext(ctx: Partial<AssistantContext>, autoMessage?: string): void
  close(): void
  clearPendingMessage(): void
}

const AssistantStateContext = createContext<AssistantStateValue>({
  isOpen: false,
  context: DEFAULT_CONTEXT,
  pendingMessage: null,
  openWithContext: () => {},
  close: () => {},
  clearPendingMessage: () => {}
})

export function AssistantStateProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<AssistantContext>(DEFAULT_CONTEXT)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const openWithContext = useCallback(
    async (ctx: Partial<AssistantContext>, autoMessage?: string) => {
      // 툴 목록 + ENV 키는 항상 최신으로 보강
      try {
        const [toolLibrary, availableEnvKeys] = await Promise.all([
          window.electronAPI.tools.list(),
          window.electronAPI.envs.listKeys()
        ])
        setContext((prev) => ({ ...prev, toolLibrary, availableEnvKeys, ...ctx }))
      } catch {
        setContext((prev) => ({ ...prev, ...ctx }))
      }

      if (autoMessage) setPendingMessage(autoMessage)
      setIsOpen(true)
    },
    []
  )

  const close = useCallback(() => setIsOpen(false), [])
  const clearPendingMessage = useCallback(() => setPendingMessage(null), [])

  return (
    <AssistantStateContext.Provider
      value={{ isOpen, context, pendingMessage, openWithContext, close, clearPendingMessage }}
    >
      {children}
    </AssistantStateContext.Provider>
  )
}

export function useAssistantState() {
  return useContext(AssistantStateContext)
}
