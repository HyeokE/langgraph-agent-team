import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import type { RunResult } from '../../main/types/teamDefinition'
import type { TeamIndexEntry } from '../../main/types/teamDefinition'
import { useTeams } from '../hooks/useTeams'
import { EmptyState } from '../components/shared/EmptyState'
import { JsonViewer } from '../components/shared/JsonViewer'
import { formatDate, formatDuration } from '../lib/formatters'
import { cn } from '../lib/cn'

interface TeamRunHistory {
  team: TeamIndexEntry
  runs: RunResult[]
}

const REASON_LABELS: Record<string, string> = {
  max_steps: '최대 스텝 도달',
  terminated: '정상 종료',
  user_cancelled: '사용자 취소',
  error: '오류'
}

export function RunHistoryPage() {
  const navigate = useNavigate()
  const { teams } = useTeams()
  const [histories, setHistories] = useState<TeamRunHistory[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (teams.length === 0) return

    setIsLoading(true)
    Promise.all(
      teams.map(async (team) => {
        const runs = await window.electronAPI.runs.list(team.id)
        return { team, runs }
      })
    )
      .then((results) => {
        // 실행 기록이 있는 팀만 표시
        setHistories(results.filter((r) => r.runs.length > 0))
      })
      .catch(() => {
        setHistories([])
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [teams])

  const allRuns = histories.flatMap((h) =>
    h.runs.map((run) => ({ ...run, teamName: h.team.name }))
  ).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">실행 기록</h2>
        <span className="text-sm text-zinc-500">총 {allRuns.length}건</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-zinc-500">불러오는 중...</div>
          </div>
        ) : allRuns.length === 0 ? (
          <EmptyState
            icon={<History size={32} />}
            title="실행 기록이 없습니다"
            description="팀을 실행하면 여기에 기록이 저장됩니다."
            action={
              <button
                onClick={() => navigate('/')}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
              >
                팀 목록으로
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {allRuns.map((run) => {
              const isExpanded = expandedRunId === run.runId

              return (
                <div
                  key={run.runId}
                  className="rounded-lg border border-zinc-200 bg-white overflow-hidden"
                >
                  {/* 실행 요약 */}
                  <button
                    type="button"
                    onClick={() => setExpandedRunId(isExpanded ? null : run.runId)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-zinc-400 flex-none" />
                    ) : (
                      <ChevronRight size={16} className="text-zinc-400 flex-none" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">{run.teamName}</span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          run.reason === 'terminated'
                            ? 'bg-green-100 text-green-700'
                            : run.reason === 'max_steps'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-zinc-100 text-zinc-600'
                        )}>
                          {REASON_LABELS[run.reason] ?? run.reason}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatDate(run.startedAt)} · {formatDuration(run.startedAt, run.finishedAt)} · {run.steps}스텝
                      </p>
                    </div>
                  </button>

                  {/* 실행 상세 */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 px-5 py-4 space-y-4">
                      {/* 라우팅 추적 */}
                      {run.routeTrace.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-medium text-zinc-500">라우팅 추적</h4>
                          <div className="space-y-1">
                            {run.routeTrace.map((entry, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-400">{entry.step}</span>
                                <span className="font-medium text-zinc-700">{entry.from}</span>
                                <span className="text-zinc-400">→</span>
                                <span className={cn(
                                  'font-medium',
                                  entry.to === '__end__' ? 'text-green-600' : 'text-zinc-700'
                                )}>
                                  {entry.to === '__end__' ? '완료' : entry.to}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 최종 상태 */}
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-zinc-500">최종 상태</h4>
                        <JsonViewer data={run.state} maxHeight="200px" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
