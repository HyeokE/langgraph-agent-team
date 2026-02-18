import { cn } from '../../lib/cn'

interface JsonViewerProps {
  data: unknown
  maxHeight?: string
  className?: string
}

export function JsonViewer({ data, maxHeight = '400px', className }: JsonViewerProps) {
  const formatted = (() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  })()

  return (
    <pre
      className={cn(
        'overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100 font-mono',
        className
      )}
      style={{ maxHeight }}
    >
      <code>{formatted}</code>
    </pre>
  )
}
