import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Square, ArrowLeft, Loader2, Bot } from 'lucide-react'
import { useTeam } from '../hooks/useTeams'
import { useRunStream } from '../hooks/useRunStream'
import { RunConsole } from '../components/run-monitor/RunConsole'
import { RouteTrace } from '../components/run-monitor/RouteTrace'
import { StateViewer } from '../components/run-monitor/StateViewer'
import { useAssistantState } from '../contexts/AssistantStateContext'
import { cn } from '../lib/cn'
import type { StateFieldDefinition } from '../../main/types/teamDefinition'

// StateFieldDefinition 타입에 맞는 초기값 반환
function getDefaultValue(field: StateFieldDefinition): unknown {
  if (field.default !== undefined) return field.default
  if (field.enumValues && field.enumValues.length > 0) return field.enumValues[0]
  switch (field.type) {
    case 'string': return ''
    case 'number': return 0
    case 'boolean': return false
    case 'string[]': return []
    case 'number[]': return []
    case 'object': return {}
    default: return ''
  }
}

const STATUS_LABELS = {
  idle: '',
  running: '실행 중',
  completed: '완료',
  error: '오류 발생',
  cancelled: '취소됨'
}

const STATUS_COLORS = {
  idle: '',
  running: 'text-blue-600',
  completed: 'text-green-600',
  error: 'text-red-600',
  cancelled: 'text-zinc-500'
}

/**
 * 실행 이벤트에서 마지막 오류 메시지 추출
 */
function extractLastError(events: ReturnType<typeof useRunStream>['events']): string | undefined {
  const errorEvents = events.filter((e) => e.type === 'error')
  if (errorEvents.length === 0) return undefined
  const last = errorEvents[errorEvents.length - 1]
  const data = last?.data as Record<string, unknown> | undefined
  return typeof data?.message === 'string' ? data.message : JSON.stringify(data)
}

/**
 * 실행 이벤트에서 마지막 상태 추출
 */
function extractFinalState(events: ReturnType<typeof useRunStream>['events']): Record<string, unknown> | undefined {
  const completeEvent = events.findLast?.((e) => e.type === 'complete')
  if (!completeEvent) return undefined
  const data = completeEvent.data as Record<string, unknown> | undefined
  return data?.state as Record<string, unknown> | undefined
}

export function TeamRunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { team, isLoading, error: teamError } = useTeam(id)
  const { sessionId, status, events, chatMessages, startRun, cancelRun } = useRunStream()
  const { openWithContext } = useAssistantState()

  // 입력 상태 (StateFieldDefinition 기반으로 동적 생성)
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({})

  // 어시스턴트 트리거 여부 추적 (실행 결과당 한 번만)
  const assistantTriggeredRef = useRef(false)

  // 팀 로드 완료 후 입력 초기값 설정
  const inputWithDefaults = team
    ? Object.fromEntries(
        team.stateFields
          .filter((f) => !f.optional)
          .map((f) => [f.name, inputValues[f.name] ?? getDefaultValue(f)])
      )
    : {}

  // 실행 완료/오류 시 어시스턴트에 분석 요청 전달
  useEffect(() => {
    if (assistantTriggeredRef.current) return
    if (!team) return
    if (status !== 'error' && status !== 'completed') return

    assistantTriggeredRef.current = true
    const lastError = extractLastError(events)
    const finalState = extractFinalState(events)

    if (status === 'error' && lastError) {
      // 오류 발생 시: 원인 분석 + 툴 제안 자동 요청
      const autoMessage =
        `"${team.name}" 팀 실행 중 오류가 발생했습니다.\n\n` +
        `오류 내용: ${lastError}\n\n` +
        `이 오류의 원인을 분석하고, 해결하는 데 필요한 툴이 있다면 만들어 주세요. ` +
        `예를 들어 외부 API 호출이 필요하다면 HTTP 툴을, 데이터 변환이 필요하면 Script 툴을 제안해 주세요.`

      void openWithContext(
        {
          currentTeam: team,
          lastRunError: lastError
        },
        autoMessage
      )
    } else if (status === 'completed' && finalState) {
      // 완료 시: 결과를 보고 최적화 툴 제안 (자동 전송 없이 컨텍스트만 업데이트)
      void openWithContext({ currentTeam: team })
    }
  }, [status, events, team, openWithContext])

  // 실행 시작 시 트리거 리셋
  useEffect(() => {
    if (status === 'running') {
      assistantTriggeredRef.current = false
    }
  }, [status])

  const handleStart = async () => {
    if (!id) return
    await startRun(id, inputWithDefaults)
  }

  const handleCancel = async () => {
    await cancelRun()
  }

  const handleAskAssistant = () => {
    if (!team) return
    const lastError = extractLastError(events)
    const message = lastError
      ? `"${team.name}" 팀 실행 오류를 분석하고 툴 추천해줘:\n${lastError}`
      : `"${team.name}" 팀 실행 결과를 보고 더 잘 작동하도록 툴을 만들어줘`
    void openWithContext({ currentTeam: team, lastRunError: lastError }, message)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-zinc-500">팀 정보를 불러오는 중...</div>
      </div>
    )
  }

  if (teamError || !team) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-sm text-red-500">{teamError ?? '팀을 찾을 수 없습니다.'}</div>
      </div>
    )
  }

  const isRunning = status === 'running'
  const isDone = status === 'completed' || status === 'error'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{team.name}</h2>
            {status !== 'idle' && (
              <p className={cn('text-xs font-medium', STATUS_COLORS[status])}>
                {STATUS_LABELS[status]}
                {sessionId && status === 'running' && (
                  <span className="ml-2 text-zinc-400 font-normal">({sessionId.slice(0, 8)}…)</span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 실행 완료/오류 후: AI 분석 버튼 */}
          {isDone && (
            <button
              onClick={handleAskAssistant}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Bot size={14} />
              AI 분석
            </button>
          )}

          {isRunning ? (
            <button
              onClick={() => void handleCancel()}
              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <Square size={14} />
              취소
            </button>
          ) : (
            <button
              onClick={() => void handleStart()}
              disabled={isRunning}
              className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              실행
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 입력 패널 */}
        <div className="w-72 flex-none border-r border-zinc-200 overflow-y-auto p-4 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            입력 값
          </h3>

          {team.stateFields.filter((f) => !f.optional).map((field) => {
            const enumValues = field.enumValues ?? []
            const hasEnumValues = enumValues.length > 0
            const currentValue = inputValues[field.name] ?? getDefaultValue(field)
            const selectedIndex = enumValues.findIndex((value) => Object.is(value, currentValue))
            const normalizedIndex = selectedIndex >= 0 ? selectedIndex : 0

            return (
              <div key={field.name}>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  {field.name}
                  {field.description && (
                    <span className="ml-1 text-zinc-400 font-normal">({field.description})</span>
                  )}
                </label>

                {hasEnumValues ? (
                  <select
                    value={String(normalizedIndex)}
                    onChange={(e) => {
                      const nextIndex = Number(e.target.value)
                      const nextValue = enumValues[nextIndex]
                      setInputValues((prev) => ({
                        ...prev,
                        [field.name]: nextValue
                      }))
                    }}
                    disabled={isRunning}
                    className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none disabled:bg-zinc-50"
                  >
                    {enumValues.map((value, index) => (
                      <option key={index} value={String(index)}>
                        {typeof value === 'boolean'
                          ? value ? 'true (참)' : 'false (거짓)'
                          : String(value)}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(inputValues[field.name] ?? false)}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [field.name]: e.target.checked }))
                    }
                    disabled={isRunning}
                    className="rounded"
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    value={String(inputValues[field.name] ?? '')}
                    onChange={(e) =>
                      setInputValues((prev) => ({
                        ...prev,
                        [field.name]: parseFloat(e.target.value) || 0
                      }))
                    }
                    disabled={isRunning}
                    className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none disabled:bg-zinc-50"
                    style={{ userSelect: 'text' }}
                  />
                ) : (
                  <textarea
                    value={String(inputValues[field.name] ?? '')}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    disabled={isRunning}
                    rows={3}
                    placeholder={`${field.name} 입력...`}
                    className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none disabled:bg-zinc-50"
                    style={{ userSelect: 'text' }}
                  />
                )}
              </div>
            )
          })}

          {team.stateFields.filter((f) => !f.optional).length === 0 && (
            <p className="text-xs text-zinc-400">
              이 팀에는 필수 입력 필드가 없습니다.
            </p>
          )}
        </div>

        {/* 오른쪽: 모니터링 패널 */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          {/* 상단: 라우팅 추적 + 상태 뷰어 */}
          <div className="flex gap-3 h-48 flex-none">
            <RouteTrace events={events} className="flex-1" />
            <StateViewer events={events} className="flex-1" />
          </div>

          {/* 하단: 실행 콘솔 (채팅 + 로그 탭) */}
          <RunConsole
            events={events}
            chatMessages={chatMessages}
            agentNames={
              team
                ? Object.fromEntries(team.agents.map((a) => [a.id, a.name]))
                : undefined
            }
            className="flex-1 min-h-0"
          />
        </div>
      </div>
    </div>
  )
}
