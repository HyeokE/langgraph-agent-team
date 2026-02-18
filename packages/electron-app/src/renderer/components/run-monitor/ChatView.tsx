import { useEffect, useRef } from 'react'
import { Bot } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { ChatMessageData } from '../../hooks/useRunStream'

interface ChatViewProps {
  messages: ChatMessageData['message'][]
  agentNames?: Record<string, string>
  className?: string
}

/** @mention 텍스트를 강조 표시합니다 */
function renderContent(content: string): React.ReactNode {
  const parts = content.split(/(@[a-zA-Z0-9_-]+)/g)

  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">
          {part}
        </span>
      )
    }
    return part
  })
}

/** 에이전트 ID를 색상 인덱스로 변환 (일관된 색상 배정) */
function agentColorClass(agentId: string): string {
  const palette = [
    'bg-violet-100 text-violet-800',
    'bg-sky-100 text-sky-800',
    'bg-emerald-100 text-emerald-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-indigo-100 text-indigo-800'
  ]
  let hash = 0
  for (const ch of agentId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

export function ChatView({ messages, agentNames = {}, className }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-zinc-400 text-sm', className)}>
        에이전트들이 채팅을 시작하면 여기에 표시됩니다.
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3 p-4 overflow-y-auto', className)}>
      {messages.map((msg) => {
        const displayName = agentNames[msg.agentId] ?? msg.agentName ?? msg.agentId
        const colorClass = agentColorClass(msg.agentId)
        const timeStr = new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })

        return (
          <div key={msg.id} className="flex items-start gap-2.5">
            {/* 아바타 */}
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                colorClass
              )}
            >
              <Bot size={14} />
            </div>

            {/* 말풍선 */}
            <div className="flex max-w-[80%] flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-zinc-700">{displayName}</span>
                <span className="text-[10px] text-zinc-400">Step {msg.step} · {timeStr}</span>
              </div>

              <div
                className={cn(
                  'rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm leading-relaxed text-zinc-800',
                  'bg-white shadow-sm border border-zinc-100'
                )}
              >
                {renderContent(msg.content)}
              </div>

              {/* mention 배지 */}
              {msg.mentions.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-1">
                  {msg.mentions.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-100"
                    >
                      → {agentNames[m] ?? m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
