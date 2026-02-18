import { Plus, Trash2 } from 'lucide-react'
import type {
  StateFieldDefinition,
  StateFieldEnumValue,
  StateFieldType
} from '../../../main/types/teamDefinition'
import { cn } from '../../lib/cn'

const FIELD_TYPES: { value: StateFieldType; label: string }[] = [
  { value: 'string', label: '문자열' },
  { value: 'number', label: '숫자' },
  { value: 'boolean', label: '참/거짓' },
  { value: 'string[]', label: '문자열 배열' },
  { value: 'number[]', label: '숫자 배열' },
  { value: 'object', label: '객체' }
]

const ENUM_SUPPORTED_TYPES: StateFieldType[] = ['string', 'number', 'boolean']

function isEnumSupportedType(type: StateFieldType): boolean {
  return ENUM_SUPPORTED_TYPES.includes(type)
}

function dedupeEnumValues(values: StateFieldEnumValue[]): StateFieldEnumValue[] {
  const seen = new Set<string>()
  const deduped: StateFieldEnumValue[] = []

  for (const value of values) {
    const key = `${typeof value}:${String(value)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(value)
  }

  return deduped
}

function parseEnumValues(type: StateFieldType, raw: string): StateFieldEnumValue[] | undefined {
  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (tokens.length === 0) return undefined

  switch (type) {
    case 'string': {
      return dedupeEnumValues(tokens)
    }
    case 'number': {
      const values = tokens
        .map((token) => Number(token))
        .filter((value) => Number.isFinite(value))
      const deduped = dedupeEnumValues(values)
      return deduped.length > 0 ? deduped : undefined
    }
    case 'boolean': {
      const values = tokens
        .map((token) => token.toLowerCase())
        .map((token) => {
          if (token === 'true' || token === '1' || token === 'yes' || token === '참') return true
          if (token === 'false' || token === '0' || token === 'no' || token === '거짓') return false
          return null
        })
        .filter((value): value is boolean => value !== null)
      const deduped = dedupeEnumValues(values)
      return deduped.length > 0 ? deduped : undefined
    }
    default:
      return undefined
  }
}

function formatEnumValues(values?: StateFieldEnumValue[]): string {
  if (!values || values.length === 0) return ''
  return values.map((value) => String(value)).join(', ')
}

interface StateFieldEditorProps {
  fields: StateFieldDefinition[]
  onChange: (fields: StateFieldDefinition[]) => void
  suggestedOutputFields?: string[]
  className?: string
}

export function StateFieldEditor({
  fields,
  onChange,
  suggestedOutputFields = [],
  className
}: StateFieldEditorProps) {
  const addField = () => {
    const newField: StateFieldDefinition = {
      name: '',
      type: 'string',
      optional: false
    }
    onChange([...fields, newField])
  }

  const updateField = (index: number, patch: Partial<StateFieldDefinition>) => {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, ...patch } : f
    )
    onChange(updated)
  }

  const removeField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index)
    onChange(updated)
  }

  const normalizedOutputFields = Array.from(
    new Set(
      suggestedOutputFields
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    )
  )
  const outputFieldSet = new Set(normalizedOutputFields)
  const currentFieldNameSet = new Set(
    fields.map((field) => field.name.trim()).filter((name) => name.length > 0)
  )
  const missingOutputFields = normalizedOutputFields.filter(
    (name) => !currentFieldNameSet.has(name)
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700">상태 필드</label>
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <Plus size={12} />
          필드 추가
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <p className="font-semibold">무엇을 설정하나요?</p>
        <p>
          `실행 입력 필수`가 켜진 필드는 실행 화면에서 사람이 직접 입력합니다.
          꺼진 필드는 비워두거나 에이전트가 결과로 채울 수 있습니다.
        </p>
        <p>
          에이전트의 `출력 필드` 이름과 동일한 상태 필드를 만들어야 결과가 저장됩니다.
        </p>
      </div>

      {missingOutputFields.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">아직 상태 스키마에 없는 에이전트 출력 필드</p>
          <p>{missingOutputFields.join(', ')}</p>
        </div>
      )}

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">
          실행 입력과 에이전트 출력을 저장할 상태 필드를 추가하세요.
        </p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => {
          const showEnumInput = isEnumSupportedType(field.type)

          return (
            <div key={index} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.6fr)_120px_150px_minmax(0,1.6fr)_30px]">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  placeholder="필드명 (예: symbol)"
                  className="rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />

                <select
                  value={field.type}
                  onChange={(e) => {
                    const nextType = e.target.value as StateFieldType
                    updateField(index, {
                      type: nextType,
                      enumValues: nextType === field.type ? field.enumValues : undefined
                    })
                  }}
                  className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!(field.optional ?? false)}
                    onChange={(e) => updateField(index, { optional: !e.target.checked })}
                    className="rounded"
                  />
                  실행 입력 필수
                </label>

                <input
                  type="text"
                  value={field.description ?? ''}
                  onChange={(e) => updateField(index, { description: e.target.value || undefined })}
                  placeholder="실행 화면에 보여줄 설명"
                  className="rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="flex items-center justify-center rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {showEnumInput && (
                <div className="mt-2 grid gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                  <label className="flex items-center text-xs font-medium text-zinc-600">
                    enum 허용값
                  </label>
                  <input
                    type="text"
                    value={formatEnumValues(field.enumValues)}
                    onChange={(e) => {
                      updateField(index, {
                        enumValues: parseEnumValues(field.type, e.target.value)
                      })
                    }}
                    placeholder={
                      field.type === 'number'
                        ? '예: 5, 15, 60'
                        : field.type === 'boolean'
                          ? '예: true, false'
                          : '예: BTCUSDT, ETHUSDT'
                    }
                    className="rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    !(field.optional ?? false)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-zinc-200 text-zinc-700'
                  )}
                >
                  {!(field.optional ?? false)
                    ? '실행 시 사용자 입력'
                    : '선택값 또는 에이전트 출력'}
                </span>
                {field.enumValues && field.enumValues.length > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">
                    enum {field.enumValues.length}개
                  </span>
                )}
                {outputFieldSet.has(field.name.trim()) && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                    에이전트 출력 매핑됨
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
