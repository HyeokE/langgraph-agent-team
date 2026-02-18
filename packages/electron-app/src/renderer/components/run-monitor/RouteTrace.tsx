import { ArrowRight } from 'lucide-react'
import type { RunEvent } from '../../hooks/useRunStream'
import { cn } from '../../lib/cn'

interface RouteEntry {
  step: number
  from: string
  to: string
  timestamp: string
}

function extractRouteEntries(events: RunEvent[]): RouteEntry[] {
  return events
    .filter((e) => e.type === 'route')
    .map((e) => {
      const data = e.data as { step?: number; from?: string; to?: string; timestamp?: string }
      return {
        step: data.step ?? 0,
        from: data.from ?? '?',
        to: data.to ?? '?',
        timestamp: data.timestamp ?? e.timestamp
      }
    })
}

interface RouteTraceProps {
  events: RunEvent[]
  className?: string
}

export function RouteTrace({ events, className }: RouteTraceProps) {
  const routes = extractRouteEntries(events)

  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white', className)}>
      <div className="border-b border-zinc-200 px-4 py-2">
        <span className="text-xs font-medium text-zinc-600">라우팅 추적</span>
      </div>

      <div className="p-3">
        {routes.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            라우팅 이벤트가 없습니다.
          </div>
        ) : (
          <div className="space-y-1">
            {routes.map((route, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                  {route.step}
                </span>
                <span className={cn(
                  'font-medium',
                  route.from === 'supervisor' ? 'text-blue-600' : 'text-zinc-700'
                )}>
                  {route.from}
                </span>
                <ArrowRight size={12} className="text-zinc-400" />
                <span className={cn(
                  'font-medium',
                  route.to === '__end__' ? 'text-green-600' : 'text-zinc-700'
                )}>
                  {route.to === '__end__' ? '완료' : route.to}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
