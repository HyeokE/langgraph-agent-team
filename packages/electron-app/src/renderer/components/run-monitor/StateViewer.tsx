import { Database } from 'lucide-react'
import type { RunEvent } from '../../hooks/useRunStream'
import { JsonViewer } from '../shared/JsonViewer'
import { cn } from '../../lib/cn'

/**
 * 최신 step 이벤트에서 현재 상태를 추출합니다.
 */
function extractCurrentState(events: RunEvent[]): unknown {
  const stepEvents = events.filter((e) => e.type === 'step' || e.type === 'complete')
  if (stepEvents.length === 0) return null

  const latest = stepEvents[stepEvents.length - 1]
  const data = latest.data as { state?: unknown; output?: unknown }
  return data?.state ?? data?.output ?? latest.data
}

interface StateViewerProps {
  events: RunEvent[]
  className?: string
}

export function StateViewer({ events, className }: StateViewerProps) {
  const currentState = extractCurrentState(events)

  return (
    <div className={cn('flex flex-col rounded-lg border border-zinc-200 bg-white', className)}>
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2">
        <Database size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-600">현재 상태</span>
      </div>

      <div className="flex-1 p-3">
        {currentState === null ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            실행 중 상태가 여기에 표시됩니다.
          </div>
        ) : (
          <JsonViewer data={currentState} maxHeight="100%" />
        )}
      </div>
    </div>
  )
}
