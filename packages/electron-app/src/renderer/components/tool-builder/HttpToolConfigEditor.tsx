import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { HttpToolConfig } from '../../../main/types/toolDefinition'
import { HTTP_METHODS } from '../../../main/types/toolDefinition'
import { cn } from '../../lib/cn'

interface HttpToolConfigEditorProps {
  config: HttpToolConfig
  availableEnvKeys: string[]
  onChange: (config: HttpToolConfig) => void
}

interface HeaderEntry {
  key: string
  value: string
}

function headersToEntries(headers: Record<string, string> = {}): HeaderEntry[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }))
}

function entriesToHeaders(entries: HeaderEntry[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const { key, value } of entries) {
    if (key.trim()) result[key.trim()] = value
  }
  return result
}

export function HttpToolConfigEditor({
  config,
  availableEnvKeys,
  onChange
}: HttpToolConfigEditorProps) {
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>(() =>
    headersToEntries(config.headers)
  )

  useEffect(() => {
    setHeaderEntries(headersToEntries(config.headers))
  }, [config.headers])

  const updateHeaders = (entries: HeaderEntry[]) => {
    setHeaderEntries(entries)
    onChange({ ...config, headers: entriesToHeaders(entries) })
  }

  const addHeader = () => {
    updateHeaders([...headerEntries, { key: '', value: '' }])
  }

  const removeHeader = (idx: number) => {
    updateHeaders(headerEntries.filter((_, i) => i !== idx))
  }

  const updateHeader = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = headerEntries.map((e, i) => (i === idx ? { ...e, [field]: val } : e))
    updateHeaders(updated)
  }

  const envHint =
    availableEnvKeys.length > 0
      ? `사용 가능한 ENV: ${availableEnvKeys.map((k) => `{{env.${k}}}`).join(', ')}`
      : '환경 변수를 먼저 등록하면 {{env.KEY_NAME}} 문법으로 참조할 수 있습니다'

  return (
    <div className="space-y-4">
      {/* ENV 힌트 */}
      <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        <strong>템플릿 문법:</strong> {envHint}
        <br />
        상태 참조: <code className="font-mono">{'{{state.fieldName}}'}</code>
      </div>

      {/* 메서드 + URL */}
      <div className="flex gap-2">
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-zinc-600">메서드</label>
          <select
            value={config.method}
            onChange={(e) => onChange({ ...config, method: e.target.value as HttpToolConfig['method'] })}
            className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none bg-white"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600">URL</label>
          <input
            type="text"
            value={config.url}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder="https://api.example.com/{{state.symbol}}?apikey={{env.API_KEY}}"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none"
          />
        </div>
      </div>

      {/* 헤더 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600">헤더</label>
          <button
            type="button"
            onClick={addHeader}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            <Plus size={12} />
            헤더 추가
          </button>
        </div>
        <div className="space-y-2">
          {headerEntries.map((entry, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                placeholder="Authorization"
                className="w-40 rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none"
              />
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                placeholder="Bearer {{env.API_KEY}}"
                className={cn(
                  'flex-1 rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-mono text-zinc-900',
                  'placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none'
                )}
              />
              <button
                type="button"
                onClick={() => removeHeader(idx)}
                className="flex items-center justify-center rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {headerEntries.length === 0 && (
            <p className="text-xs text-zinc-400">헤더가 없습니다</p>
          )}
        </div>
      </div>

      {/* 바디 (POST/PUT/PATCH) */}
      {['POST', 'PUT', 'PATCH'].includes(config.method) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">
            바디 <span className="text-zinc-400 font-normal">(JSON 또는 텍스트)</span>
          </label>
          <textarea
            value={config.body ?? ''}
            onChange={(e) => onChange({ ...config, body: e.target.value || undefined })}
            placeholder={'{"symbol": "{{state.symbol}}"}'}
            rows={4}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  )
}
