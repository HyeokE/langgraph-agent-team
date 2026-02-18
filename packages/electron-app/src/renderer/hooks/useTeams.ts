import { useState, useEffect, useCallback } from 'react'
import type { TeamIndexEntry, TeamDefinition } from '../../main/types/teamDefinition'

interface UseTeamsReturn {
  teams: TeamIndexEntry[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  deleteTeam: (id: string) => Promise<void>
}

/**
 * 팀 목록을 관리하는 훅
 */
export function useTeams(): UseTeamsReturn {
  const [teams, setTeams] = useState<TeamIndexEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const list = await window.electronAPI.teams.list()
      setTeams(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deleteTeam = useCallback(async (id: string) => {
    await window.electronAPI.teams.delete(id)
    // 삭제 후 목록 갱신 (새 배열 반환으로 불변성 유지)
    setTeams((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { teams, isLoading, error, refresh, deleteTeam }
}

interface UseTeamReturn {
  team: TeamDefinition | null
  isLoading: boolean
  error: string | null
}

/**
 * 단일 팀 상세 정보를 가져오는 훅
 */
export function useTeam(id: string | undefined): UseTeamReturn {
  const [team, setTeam] = useState<TeamDefinition | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setTeam(null)
      return
    }

    setIsLoading(true)
    setError(null)

    window.electronAPI.teams
      .get(id)
      .then((result) => {
        setTeam(result)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '팀 정보를 불러오는데 실패했습니다.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [id])

  return { team, isLoading, error }
}
