import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, X, Trash2, ChevronRight } from 'lucide-react'
import { useAssistant } from '../../hooks/useAssistant'
import { ChatMessageBubble } from './ChatMessage'
import type { AssistantContext } from '../../../main/types/assistantTypes'
import { cn } from '../../lib/cn'

interface AssistantPanelProps {
  context: AssistantContext
  isOpen: boolean
  /** 패널이 열릴 때 자동 전송할 메시지 (run 실패 분석 등) */
  pendingMessage?: string | null
  onPendingMessageHandled?: () => void
  onClose: () => void
}

export function AssistantPanel({
  context,
  isOpen,
  pendingMessage,
  onPendingMessageHandled,
  onClose
}: AssistantPanelProps) {
  const [input, setInput] = useState('')
  const { messages, loading, error, send, cancel, clearHistory } = useAssistant(context)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingHandled = useRef(false)

  // 새 메시지 도착 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 패널이 열리면서 pendingMessage가 있으면 자동 전송
  useEffect(() => {
    if (isOpen && pendingMessage && !pendingHandled.current && !loading) {
      pendingHandled.current = true
      void send(pendingMessage)
      onPendingMessageHandled?.()
    }

    if (!isOpen) {
      pendingHandled.current = false
    }
  }, [isOpen, pendingMessage, loading, send, onPendingMessageHandled])

  // 패널 열릴 때 입력창 포커스
  useEffect(() => {
    if (isOpen && !pendingMessage) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, pendingMessage])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    await send(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-l border-zinc-200 bg-white transition-all duration-200',
        isOpen ? 'w-80' : 'w-0 overflow-hidden'
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">AI 어시스턴트</h2>
          <p className="text-xs text-zinc-500">툴/팀 생성을 도와드립니다</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
              title="대화 지우기"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-2xl">🤖</div>
            <p className="text-xs text-zinc-500 max-w-[200px]">
              툴이나 팀 생성에 대해 질문하세요.
              <br />
              예: "Binance API로 BTC 가격 조회하는 툴 만들어줘"
            </p>
            {context.availableEnvKeys.length > 0 && (
              <p className="text-xs text-zinc-400 max-w-[200px]">
                등록된 ENV: {context.availableEnvKeys.slice(0, 3).join(', ')}
                {context.availableEnvKeys.length > 3 && ` 외 ${context.availableEnvKeys.length - 3}개`}
              </p>
            )}
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessageBubble key={idx} message={msg} />
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 size={12} className="animate-spin" />
            분석 중…
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력… (Enter로 전송)"
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-50"
            style={{ userSelect: 'text' }}
          />
          {loading ? (
            <button
              onClick={() => void cancel()}
              className="flex items-center justify-center rounded-md border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
              title="취소"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="flex items-center justify-center rounded-md bg-zinc-900 p-2 text-white hover:bg-zinc-800 disabled:opacity-30"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
