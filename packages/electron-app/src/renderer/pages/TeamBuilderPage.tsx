import { useParams } from 'react-router-dom'
import { useTeam } from '../hooks/useTeams'
import { TeamBuilderForm } from '../components/team-builder/TeamBuilderForm'

export function TeamBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const { team, isLoading, error } = useTeam(id)

  if (id && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-zinc-500">팀 정보를 불러오는 중...</div>
      </div>
    )
  }

  if (id && error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    )
  }

  return <TeamBuilderForm existingTeam={team ?? undefined} />
}
