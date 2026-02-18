import { useEffect, useRef, useState } from 'react'
import { Terminal, MessageSquare } from 'lucide-react'
import type { RunEvent, ChatMessageData } from '../../hooks/useRunStream'
import { cn } from '../../lib/cn'
import { ChatView } from './ChatView'

const EVENT_STYLES: Record<RunEvent['type'], { bg: string; label: string; text: string }> = {
  step: { bg: 'bg-blue-50', label: 'STEP', text: 'text-blue-700' },
  route: { bg: 'bg-purple-50', label: 'ROUTE', text: 'text-purple-700' },
  complete: { bg: 'bg-green-50', label: 'DONE', text: 'text-green-700' },
  error: { bg: 'bg-red-50', label: 'ERR', text: 'text-red-700' },
  message: { bg: 'bg-orange-50', label: 'CHAT', text: 'text-orange-700' }
}

type TabId = 'chat' | 'log'

interface RunConsoleProps {
  events: RunEvent[]
  chatMessages: ChatMessageData['message'][]
  agentNames?: Record<string, string>
  className?: string
}

export function RunConsole({ events, chatMessages, agentNames, className }: RunConsoleProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  // 새 이벤트 발생 시 자동 스크롤 (로그 탭)
  useEffect(() => {
    if (activeTab === 'log') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length, activeTab])

  // 새 채팅 메시지 도착 시 채팅 탭으로 자동 전환
  useEffect(() => {
    if (chatMessages.length > 0) {
      setActiveTab('chat')
    }
  }, [chatMessages.length])

  return (
    <div className={cn('flex flex-col rounded-lg border border-zinc-200 bg-zinc-950', className)}>
      {/* 탭 헤더 */}
      <div className="flex items-center border-b border-zinc-800 px-2">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'chat'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <MessageSquare size={13} />
          채팅
          {chatMessages.length > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
              {chatMessages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('log')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === 'log'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Terminal size={13} />
          로그
          <span className="text-zinc-600">({events.length})</span>
        </button>
      </div>

      {/* 채팅 탭 */}
      {activeTab === 'chat' && (
        <ChatView
          messages={chatMessages}
          agentNames={agentNames}
          className="flex-1 bg-zinc-50 min-h-0"
        />
      )}

      {/* 로그 탭 */}
      {activeTab === 'log' && (
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5">
          {events.length === 0 && (
            <div className="flex items-center justify-center py-8 text-zinc-600">
              실행을 시작하면 여기에 로그가 표시됩니다.
            </div>
          )}

          {events.map((event, index) => {
            const style = EVENT_STYLES[event.type]
            const timeStr = new Date(event.timestamp).toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })

            return (
              <div key={index} className={cn('rounded p-2', style.bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('font-bold text-[10px]', style.text)}>{style.label}</span>
                  <span className="text-zinc-500">{timeStr}</span>
                </div>
                <pre className={cn('whitespace-pre-wrap break-all text-[11px]', style.text)}>
                  {typeof event.data === 'string'
                    ? event.data
                    : JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
