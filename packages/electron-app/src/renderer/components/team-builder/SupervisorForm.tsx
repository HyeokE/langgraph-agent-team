import type { SupervisorDefinition } from '../../../main/types/teamDefinition'

interface SupervisorFormProps {
  supervisor: SupervisorDefinition
  onChange: (supervisor: SupervisorDefinition) => void
}

export function SupervisorForm({ supervisor, onChange }: SupervisorFormProps) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          S
        </span>
        <span className="text-sm font-medium text-zinc-700">Supervisor 에이전트</span>
        <span className="text-xs text-zinc-400">(라우팅 결정 담당)</span>
      </div>

      {/* Supervisor ID */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Supervisor ID</label>
        <input
          type="text"
          value={supervisor.id}
          onChange={(e) => onChange({ ...supervisor, id: e.target.value })}
          placeholder="supervisor"
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none font-mono"
        />
      </div>

      {/* 시스템 프롬프트 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">
          시스템 프롬프트{' '}
          <span className="text-zinc-400 font-normal">
            (라우팅 지침 — JSON 응답 형식은 자동으로 주입됩니다)
          </span>
        </label>
        <textarea
          value={supervisor.systemPrompt}
          onChange={(e) => onChange({ ...supervisor, systemPrompt: e.target.value })}
          placeholder="팀의 목표와 각 에이전트를 언제 호출할지 지침을 작성하세요..."
          rows={4}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
          style={{ userSelect: 'text' }}
        />
      </div>
    </div>
  )
}
