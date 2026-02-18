import { useState, useEffect } from 'react'
import { Code2, Globe } from 'lucide-react'
import type { ToolDefinition, ToolConfig } from '../../../main/types/toolDefinition'
import { HttpToolConfigEditor } from './HttpToolConfigEditor'
import { ScriptToolConfigEditor } from './ScriptToolConfigEditor'
import { cn } from '../../lib/cn'

interface ToolBuilderFormProps {
  initial?: ToolDefinition
  availableEnvKeys: string[]
  onSubmit: (data: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}

const DEFAULT_HTTP_CONFIG: ToolConfig = {
  type: 'http',
  method: 'GET',
  url: ''
}

const DEFAULT_SCRIPT_CONFIG: ToolConfig = {
  type: 'script',
  code: 'return JSON.stringify(state)'
}

export function ToolBuilderForm({
  initial,
  availableEnvKeys,
  onSubmit,
  onCancel
}: ToolBuilderFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [config, setConfig] = useState<ToolConfig>(initial?.config ?? DEFAULT_HTTP_CONFIG)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 타입 전환 시 기본값으로 초기화
  const switchType = (type: 'http' | 'script') => {
    if (type === config.type) return
    setConfig(type === 'http' ? DEFAULT_HTTP_CONFIG : DEFAULT_SCRIPT_CONFIG)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('툴 이름을 입력하세요')
      return
    }
    if (config.type === 'http' && !config.url.trim()) {
      setError('URL을 입력하세요')
      return
    }
    if (config.type === 'script' && !config.code.trim()) {
      setError('코드를 입력하세요')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined, config })
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (initial) {
      setName(initial.name)
      setDescription(initial.description ?? '')
      setConfig(initial.config)
    }
  }, [initial])

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 이름 + 설명 */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">툴 이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: Binance 가격 조회"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">설명</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: Binance API에서 암호화폐 현재가를 조회합니다"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      {/* 타입 토글 */}
      <div>
        <label className="mb-2 block text-xs font-medium text-zinc-600">툴 타입</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchType('http')}
            className={cn(
              'flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              config.type === 'http'
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
            )}
          >
            <Globe size={15} />
            HTTP
          </button>
          <button
            type="button"
            onClick={() => switchType('script')}
            className={cn(
              'flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              config.type === 'script'
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
            )}
          >
            <Code2 size={15} />
            Script
          </button>
        </div>
      </div>

      {/* 설정 에디터 */}
      <div className="rounded-lg border border-zinc-200 p-4">
        {config.type === 'http' ? (
          <HttpToolConfigEditor
            config={config}
            availableEnvKeys={availableEnvKeys}
            onChange={setConfig}
          />
        ) : (
          <ScriptToolConfigEditor
            config={config}
            availableEnvKeys={availableEnvKeys}
            onChange={setConfig}
          />
        )}
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* 액션 */}
      <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? '저장 중…' : initial ? '업데이트' : '툴 생성'}
        </button>
      </div>
    </form>
  )
}
