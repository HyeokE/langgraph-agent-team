import { useNavigate } from 'react-router-dom'
import { Plus, Play, Pencil, Trash2, Users } from 'lucide-react'
import { useTeams } from '../hooks/useTeams'
import { EmptyState } from '../components/shared/EmptyState'
import { formatRelativeTime } from '../lib/formatters'
import { cn } from '../lib/cn'

export function TeamsPage() {
  const navigate = useNavigate()
  const { teams, isLoading, error, deleteTeam } = useTeams()

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`"${name}" 팀을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)
    if (!confirmed) return

    try {
      await deleteTeam(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-zinc-500">팀 목록을 불러오는 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">팀 목록</h2>
        <button
          onClick={() => navigate('/teams/new')}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <Plus size={16} />
          새 팀 만들기
        </button>
      </div>

      {/* 팀 목록 */}
      <div className="flex-1 overflow-y-auto p-6">
        {teams.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title="등록된 팀이 없습니다"
            description="새 팀을 만들어 에이전트를 구성하고 자동화를 시작하세요."
            action={
              <button
                onClick={() => navigate('/teams/new')}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                <Plus size={16} />
                첫 팀 만들기
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="group relative flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                {/* 카테고리 뱃지 */}
                <span className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  {team.category}
                </span>

                {/* 팀 이름 */}
                <h3 className="text-base font-semibold text-zinc-900 leading-tight">
                  {team.name}
                </h3>

                {/* 업데이트 시간 */}
                <p className="text-xs text-zinc-400">
                  {formatRelativeTime(team.updatedAt)} 수정됨
                </p>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/teams/${team.id}/run`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    <Play size={12} />
                    실행
                  </button>
                  <button
                    onClick={() => navigate(`/teams/${team.id}/edit`)}
                    className="flex items-center justify-center rounded-md border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50"
                    title="편집"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void handleDelete(team.id, team.name)}
                    className="flex items-center justify-center rounded-md border border-zinc-200 p-1.5 text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
