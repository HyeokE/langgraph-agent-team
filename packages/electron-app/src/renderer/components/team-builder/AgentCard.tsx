import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { AgentDefinition } from '../../../main/types/teamDefinition'
import type { ToolIndexEntry } from '../../../main/types/toolDefinition'
import { cn } from '../../lib/cn'

interface AgentCardProps {
  agent: AgentDefinition
  index: number
  availableTools: ToolIndexEntry[]
  onChange: (patch: Partial<AgentDefinition>) => void
  onRemove: () => void
}

export function AgentCard({ agent, index, availableTools, onChange, onRemove }: AgentCardProps) {
  const [expanded, setExpanded] = useState(true)

  const toggleTool = (toolId: string) => {
    const current = agent.toolIds ?? []
    const updated = current.includes(toolId)
      ? current.filter((id) => id !== toolId)
      : [...current, toolId]
    onChange({ toolIds: updated })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
          {index + 1}
        </span>

        <input
          type="text"
          value={agent.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="에이전트 이름"
          className="flex-1 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-center rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-50"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center rounded p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 카드 바디 */}
      {expanded && (
        <div className="space-y-3 border-t border-zinc-100 px-4 pb-4 pt-3">
          {/* 역할 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">역할</label>
            <input
              type="text"
              value={agent.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder="예: 시장 데이터 분석가"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          {/* ID (자동 생성, 읽기 전용) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              ID{' '}
              <span className="text-zinc-400 font-normal">(에이전트 라우팅에 사용됨)</span>
            </label>
            <input
              type="text"
              value={agent.id}
              onChange={(e) => onChange({ id: e.target.value })}
              placeholder="agent-id (소문자, 하이픈만 허용)"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none font-mono"
            />
          </div>

          {/* 출력 필드 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              출력 필드{' '}
              <span className="text-zinc-400 font-normal">
                (아래 상태 스키마의 필드명과 정확히 일치해야 함)
              </span>
            </label>
            <input
              type="text"
              value={agent.outputField}
              onChange={(e) => onChange({ outputField: e.target.value })}
              placeholder="예: marketAnalysis"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none font-mono"
            />
          </div>

          {/* 시스템 프롬프트 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">시스템 프롬프트</label>
            <textarea
              value={agent.systemPrompt}
              onChange={(e) => onChange({ systemPrompt: e.target.value })}
              placeholder="이 에이전트의 역할과 행동 방식을 정의하세요..."
              rows={4}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
              style={{ userSelect: 'text' }}
            />
          </div>

          {/* 툴 할당 */}
          {availableTools.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                사용할 툴{' '}
                <span className="text-zinc-400 font-normal">(에이전트 실행 전 자동 호출)</span>
              </label>
              <div className="space-y-1.5">
                {availableTools.map((tool) => {
                  const checked = (agent.toolIds ?? []).includes(tool.id)
                  return (
                    <label
                      key={tool.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors',
                        checked
                          ? 'border-zinc-400 bg-zinc-50 text-zinc-900'
                          : 'border-zinc-100 text-zinc-600 hover:border-zinc-200'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTool(tool.id)}
                        className="rounded"
                      />
                      <span className="font-medium">{tool.name}</span>
                      <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500 uppercase font-medium">
                        {tool.type}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
