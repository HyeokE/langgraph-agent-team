import { CheckCircle, Wrench, Users } from 'lucide-react'
import type { AssistantAction } from '../../../main/types/assistantTypes'

interface ActionCardProps {
  action: AssistantAction
  result?: string
}

const ACTION_LABELS: Record<AssistantAction['type'], string> = {
  createTool: '툴 생성',
  updateTool: '툴 업데이트',
  createTeam: '팀 생성',
  updateTeam: '팀 업데이트'
}

export function ActionCard({ action, result }: ActionCardProps) {
  const isTeamAction = action.type === 'createTeam' || action.type === 'updateTeam'
  const label = ACTION_LABELS[action.type]
  const name = 'spec' in action && action.spec
    ? (action.spec as { name?: string }).name
    : undefined

  return (
    <div className="max-w-[85%] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-emerald-700">
        {isTeamAction ? <Users size={12} /> : <Wrench size={12} />}
        {label}
        {name && <span className="font-normal text-emerald-600">— {name}</span>}
      </div>
      {result && (
        <div className="mt-1 flex items-center gap-1 text-emerald-600">
          <CheckCircle size={11} />
          <span>{result}</span>
        </div>
      )}
    </div>
  )
}
