import { Plus, Bot } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { AgentDefinition } from '../../../main/types/teamDefinition'
import type { ToolIndexEntry } from '../../../main/types/toolDefinition'
import { AgentCard } from './AgentCard'

interface AgentListProps {
  agents: AgentDefinition[]
  availableTools: ToolIndexEntry[]
  onChange: (agents: AgentDefinition[]) => void
}

export function AgentList({ agents, availableTools, onChange }: AgentListProps) {
  const addAgent = () => {
    const id = `agent-${uuidv4().slice(0, 8)}`
    const newAgent: AgentDefinition = {
      id,
      name: '',
      role: '',
      systemPrompt: '',
      outputField: ''
    }
    onChange([...agents, newAgent])
  }

  const updateAgent = (index: number, patch: Partial<AgentDefinition>) => {
    const updated = agents.map((a, i) =>
      i === index ? { ...a, ...patch } : a
    )
    onChange(updated)
  }

  const removeAgent = (index: number) => {
    const updated = agents.filter((_, i) => i !== index)
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700">
          에이전트 목록{' '}
          <span className="text-xs font-normal text-zinc-400">
            ({agents.length}개)
          </span>
        </label>
        <button
          type="button"
          onClick={addAgent}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          <Plus size={12} />
          에이전트 추가
        </button>
      </div>

      {agents.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-zinc-200 p-8 text-center">
          <Bot size={32} className="text-zinc-300" />
          <div>
            <p className="text-sm font-medium text-zinc-600">에이전트가 없습니다</p>
            <p className="mt-1 text-xs text-zinc-400">
              에이전트를 추가하여 팀을 구성하세요. 최소 1개 이상의 에이전트가 필요합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={addAgent}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <Plus size={12} />
            첫 에이전트 추가
          </button>
        </div>
      )}

      <div className="space-y-3">
        {agents.map((agent, index) => (
          <AgentCard
            key={agent.id || index}
            agent={agent}
            index={index}
            availableTools={availableTools}
            onChange={(patch) => updateAgent(index, patch)}
            onRemove={() => removeAgent(index)}
          />
        ))}
      </div>
    </div>
  )
}
