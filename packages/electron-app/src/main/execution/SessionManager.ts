import { v4 as uuidv4 } from 'uuid'
import type { AgentTeam, TeamRunResult } from '@agent-team/langgraph-team-factory'

export type SessionEventType = 'step' | 'route' | 'complete' | 'error' | 'message'

export interface SessionEvent {
  sessionId: string
  type: SessionEventType
  data: unknown
}

type EventListener = (event: SessionEvent) => void

interface ActiveSession {
  abortController: AbortController
  teamId: string
  startedAt: string
}

function serializeError(error: Error): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }

  if (error.stack) {
    base.stack = error.stack
  }

  for (const key of Object.getOwnPropertyNames(error)) {
    if (key === 'name' || key === 'message' || key === 'stack') continue
    base[key] = (error as unknown as Record<string, unknown>)[key]
  }

  return base
}

function toSerializable(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value instanceof Error) {
    return toSerializable(serializeError(value), seen)
  }

  if (value === null || value === undefined) return value

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item, seen))
  }

  if (valueType === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)

    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toSerializable(child, seen)
    }
    return out
  }

  return String(value)
}

/**
 * 활성 실행 세션을 관리합니다.
 * - 각 세션마다 독립적인 AbortController를 유지
 * - 이벤트 리스너 패턴으로 IPC 브릿지와 결합
 */
export class SessionManager {
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly listeners = new Map<string, Set<EventListener>>()

  /**
   * 팀 실행을 시작하고 세션 ID를 반환합니다.
   */
  async start(
    teamId: string,
    team: AgentTeam<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>,
    input: Record<string, unknown>
  ): Promise<string> {
    const sessionId = uuidv4()
    const abortController = new AbortController()

    this.sessions.set(sessionId, {
      abortController,
      teamId,
      startedAt: new Date().toISOString()
    })

    // 비동기로 실행 시작 (await 없이 백그라운드 실행)
    team
      .run(input, {
        signal: abortController.signal,
        hooks: {
          onStep: (e) => this.emit(sessionId, 'step', e),
          onRoute: (e) => this.emit(sessionId, 'route', e),
          onError: (e) => this.emit(sessionId, 'error', e),
          onMessage: (e) => this.emit(sessionId, 'message', e)
        }
      })
      .then((result: TeamRunResult<Record<string, unknown>, Record<string, unknown>>) => {
        this.emit(sessionId, 'complete', result)
      })
      .catch((err: unknown) => {
        this.emit(sessionId, 'error', { error: toSerializable(err) })
      })
      .finally(() => {
        this.sessions.delete(sessionId)
        this.listeners.delete(sessionId)
      })

    return sessionId
  }

  /**
   * 세션을 취소합니다.
   * @returns 세션이 존재하면 true, 없으면 false
   */
  cancel(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.abortController.abort('User cancelled')
    return true
  }

  /**
   * 세션 이벤트 리스너를 등록합니다.
   * @returns 리스너 제거 함수
   */
  onEvent(sessionId: string, listener: EventListener): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set())
    }

    const listenerSet = this.listeners.get(sessionId)!
    listenerSet.add(listener)

    return () => {
      listenerSet.delete(listener)
    }
  }

  /**
   * 현재 활성 세션 ID 목록을 반환합니다.
   */
  getActiveSessions(): Array<{ sessionId: string; teamId: string; startedAt: string }> {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      teamId: session.teamId,
      startedAt: session.startedAt
    }))
  }

  private emit(sessionId: string, type: SessionEventType, data: unknown): void {
    const listenerSet = this.listeners.get(sessionId)
    if (!listenerSet) return

    const event: SessionEvent = { sessionId, type, data: toSerializable(data) }
    for (const listener of listenerSet) {
      try {
        listener(event)
      } catch {
        // 리스너 오류가 실행을 중단시키지 않도록 무시
      }
    }
  }
}
