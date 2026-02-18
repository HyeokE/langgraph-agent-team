import { cn } from '../../lib/cn'
import type { AssistantMessage } from '../../hooks/useAssistant'
import { ActionCard } from './ActionCard'

interface ChatMessageProps {
  message: AssistantMessage
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-zinc-900 text-white'
            : 'bg-zinc-100 text-zinc-900'
        )}
      >
        {message.content}
      </div>

      {message.action && (
        <ActionCard
          action={message.action}
          result={message.actionResult}
        />
      )}
    </div>
  )
}
