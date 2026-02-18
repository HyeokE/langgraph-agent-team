import { ipcMain, type BrowserWindow } from 'electron'
import { TeamRepository } from '../storage/TeamRepository.js'
import { ToolRepository } from '../storage/ToolRepository.js'
import { EnvStore } from '../storage/EnvStore.js'
import { SessionManager } from '../execution/SessionManager.js'
import { buildTeam } from '../execution/teamBuilder.js'
import { bridgeSessionToWindow } from './executionBridge.js'
import { createClipProxyAdapter, checkClipProxyHealth } from '../model/cliproxyAdapter.js'
import { isProxyRunning } from '../setup/cliproxyManager.js'
import { handleAssistantMessage } from '../assistant/assistantSession.js'
import { triggerCodexLogin, getCodexTokenInfo, isTokenValid } from '../auth/codexAuth.js'
import type { TeamDefinition } from '../types/teamDefinition.js'
import type { ToolDefinition } from '../types/toolDefinition.js'
import type { AssistantContext } from '../types/assistantTypes.js'

// IPC 채널 상수 (렌더러 타입 선언과 동기화 필요)
const CHANNELS = {
  TEAMS_LIST: 'teams:list',
  TEAMS_GET: 'teams:get',
  TEAMS_CREATE: 'teams:create',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_DELETE: 'teams:delete',
  TOOLS_LIST: 'tools:list',
  TOOLS_GET: 'tools:get',
  TOOLS_CREATE: 'tools:create',
  TOOLS_UPDATE: 'tools:update',
  TOOLS_DELETE: 'tools:delete',
  ENVS_LIST: 'envs:list',
  ENVS_SET: 'envs:set',
  ENVS_DELETE: 'envs:delete',
  ENVS_LIST_KEYS: 'envs:listKeys',
  EXECUTION_START: 'execution:start',
  EXECUTION_CANCEL: 'execution:cancel',
  EXECUTION_LIST_ACTIVE: 'execution:listActive',
  AUTH_STATUS: 'auth:status',
  AUTH_LOGIN: 'auth:login',
  AUTH_SET_TOKEN: 'auth:setToken',
  SETUP_STATUS: 'setup:status',
  AUTH_LOGOUT: 'auth:logout',
  RUNS_LIST: 'runs:list',
  ASSISTANT_SEND: 'assistant:send',
  ASSISTANT_CANCEL: 'assistant:cancel'
} as const

// Google OAuth 토큰 임시 저장소 (실제 구현에서는 tokenStore.ts로 이동)
let currentAccessToken: string | null = null

// 어시스턴트 세션 취소 컨트롤러 맵
const assistantControllers = new Map<string, AbortController>()

/**
 * 모든 IPC 핸들러를 등록합니다.
 * 앱 시작 시 한 번만 호출되어야 합니다.
 */
export function registerIpcHandlers(
  win: BrowserWindow,
  sessionManager: SessionManager
): void {
  // ── 팀 CRUD ──────────────────────────────────────────
  ipcMain.handle(CHANNELS.TEAMS_LIST, async () => {
    return await TeamRepository.list()
  })

  ipcMain.handle(CHANNELS.TEAMS_GET, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid team id')
    return await TeamRepository.get(id)
  })

  ipcMain.handle(CHANNELS.TEAMS_CREATE, async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid team definition')
    }
    return await TeamRepository.create(
      input as Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'>
    )
  })

  ipcMain.handle(CHANNELS.TEAMS_UPDATE, async (_event, id: string, patch: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid team id')
    if (!patch || typeof patch !== 'object') throw new Error('Invalid patch')
    return await TeamRepository.update(
      id,
      patch as Partial<Omit<TeamDefinition, 'id' | 'createdAt'>>
    )
  })

  ipcMain.handle(CHANNELS.TEAMS_DELETE, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid team id')
    await TeamRepository.delete(id)
    return { success: true }
  })

  // ── 툴 CRUD ──────────────────────────────────────────
  ipcMain.handle(CHANNELS.TOOLS_LIST, async () => {
    return await ToolRepository.list()
  })

  ipcMain.handle(CHANNELS.TOOLS_GET, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid tool id')
    return await ToolRepository.get(id)
  })

  ipcMain.handle(CHANNELS.TOOLS_CREATE, async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid tool definition')
    return await ToolRepository.create(
      input as Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>
    )
  })

  ipcMain.handle(CHANNELS.TOOLS_UPDATE, async (_event, id: string, patch: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid tool id')
    if (!patch || typeof patch !== 'object') throw new Error('Invalid patch')
    return await ToolRepository.update(
      id,
      patch as Partial<Omit<ToolDefinition, 'id' | 'createdAt'>>
    )
  })

  ipcMain.handle(CHANNELS.TOOLS_DELETE, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid tool id')
    await ToolRepository.delete(id)
    return { success: true }
  })

  // ── ENV 보안 저장소 ───────────────────────────────────
  // NOTE: envs:get(value) 채널 없음 — 값은 메인 프로세스에서만 접근
  ipcMain.handle(CHANNELS.ENVS_LIST, async () => {
    return await EnvStore.list()
  })

  ipcMain.handle(CHANNELS.ENVS_SET, async (_event, key: string, value: string, description?: string) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Invalid env key')
    }
    if (typeof value !== 'string') throw new Error('Invalid env value')
    return await EnvStore.set(key.trim(), value, description)
  })

  ipcMain.handle(CHANNELS.ENVS_DELETE, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid env id')
    await EnvStore.delete(id)
    return { success: true }
  })

  ipcMain.handle(CHANNELS.ENVS_LIST_KEYS, async () => {
    return await EnvStore.listKeys()
  })

  // ── 실행 관리 ─────────────────────────────────────────
  ipcMain.handle(CHANNELS.EXECUTION_START, async (_event, teamId: string, input: unknown) => {
    if (typeof teamId !== 'string') throw new Error('Invalid team id')
    if (!(await isProxyRunning())) {
      throw new Error(
        'cliproxy 서버가 실행 중이 아닙니다. 자동 셋업을 다시 실행하거나 로컬 프록시를 먼저 시작하세요.'
      )
    }
    if (!currentAccessToken) {
      const envToken = process.env['CLIPROXY_TOKEN']?.trim()
      if (envToken) currentAccessToken = envToken
    }
    if (!currentAccessToken) {
      throw new Error(
        '인증 토큰이 없습니다. 실행 화면에서 토큰을 입력하거나 CLIPROXY_TOKEN 환경 변수를 설정하세요.'
      )
    }

    const teamDef = await TeamRepository.get(teamId)
    if (!teamDef) throw new Error(`Team not found: ${teamId}`)

    // 팀에 속한 모든 에이전트의 툴 ID 수집
    const allToolIds = teamDef.agents.flatMap((a) => a.toolIds ?? [])
    const toolsById = await ToolRepository.getByIds(allToolIds)

    const modelAdapter = createClipProxyAdapter({ accessToken: currentAccessToken })
    const team = buildTeam(teamDef, modelAdapter, toolsById, EnvStore)

    const sessionId = await sessionManager.start(
      teamId,
      team,
      (input as Record<string, unknown>) ?? {}
    )

    bridgeSessionToWindow(sessionManager, sessionId, win)

    return { sessionId }
  })

  ipcMain.handle(CHANNELS.EXECUTION_CANCEL, async (_event, sessionId: string) => {
    if (typeof sessionId !== 'string') throw new Error('Invalid session id')
    const cancelled = sessionManager.cancel(sessionId)
    return { cancelled }
  })

  ipcMain.handle(CHANNELS.EXECUTION_LIST_ACTIVE, () => {
    return sessionManager.getActiveSessions()
  })

  // ── 인증 ─────────────────────────────────────────────
  ipcMain.handle(CHANNELS.AUTH_STATUS, async () => {
    const proxyRunning = await isProxyRunning()
    const tokenInfo = await getCodexTokenInfo()
    const hasValidToken = tokenInfo !== null && isTokenValid(tokenInfo)
    // 프록시가 실행 중이고 토큰이 유효하면 인증됨
    const authenticated = proxyRunning && hasValidToken && currentAccessToken !== null

    return {
      authenticated,
      proxyRunning,
      hasValidToken,
      tokenEmail: tokenInfo?.email,
      tokenExpired: tokenInfo?.expired
    }
  })

  ipcMain.handle(CHANNELS.AUTH_LOGIN, async () => {
    // Codex OAuth (OpenAI via Google) 로그인
    const tokenInfo = await triggerCodexLogin(win)
    // 로그인 성공 → 프록시 재연결 시도
    if (!currentAccessToken) {
      const envToken = process.env['CLIPROXY_TOKEN']?.trim()
      if (envToken) currentAccessToken = envToken
    }
    return {
      success: true,
      email: tokenInfo.email,
      plan: tokenInfo.plan,
      expired: tokenInfo.expired
    }
  })

  ipcMain.handle(CHANNELS.AUTH_SET_TOKEN, (_event, token: string) => {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new Error('유효한 토큰 문자열이 필요합니다.')
    }
    currentAccessToken = token.trim()
    return { success: true }
  })

  ipcMain.handle(CHANNELS.AUTH_LOGOUT, () => {
    currentAccessToken = null
    return { success: true }
  })

  // ── 실행 기록 ─────────────────────────────────────────
  ipcMain.handle(CHANNELS.RUNS_LIST, async (_event, teamId: string) => {
    if (typeof teamId !== 'string') throw new Error('Invalid team id')
    return await TeamRepository.listRuns(teamId)
  })

  // ── 셋업 상태 ──────────────────────────────────────────
  ipcMain.handle(CHANNELS.SETUP_STATUS, async () => {
    return {
      proxyRunning: await isProxyRunning(),
      hasApiKey: currentAccessToken !== null
    }
  })

  // ── AI 어시스턴트 ──────────────────────────────────────
  ipcMain.handle(CHANNELS.ASSISTANT_SEND, async (_event, message: string, context: unknown, history: unknown) => {
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Invalid message')
    }
    // execution:start와 동일한 토큰 폴백 패턴
    if (!currentAccessToken) {
      const envToken = process.env['CLIPROXY_TOKEN']?.trim()
      if (envToken) currentAccessToken = envToken
    }
    if (!currentAccessToken) {
      throw new Error('인증 토큰이 없습니다. CLIPROXY_TOKEN 환경 변수를 설정하거나 앱 셋업을 완료하세요.')
    }

    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    assistantControllers.set(requestId, controller)

    const modelAdapter = createClipProxyAdapter({ accessToken: currentAccessToken })

    // 비동기로 실행하고 requestId 즉시 반환
    const rawCtx = context as Record<string, unknown> | null ?? {}
    const assistantContext: AssistantContext = {
      toolLibrary: (rawCtx['toolLibrary'] as AssistantContext['toolLibrary']) ?? [],
      availableEnvKeys: (rawCtx['availableEnvKeys'] as string[]) ?? [],
      currentTeam: rawCtx['currentTeam'] as AssistantContext['currentTeam'],
      lastRunError: rawCtx['lastRunError'] as string | undefined
    }
    handleAssistantMessage(
      message,
      assistantContext,
      history as Array<{ role: 'user' | 'assistant'; content: string }>,
      win,
      controller.signal,
      modelAdapter
    )
      .catch((err: unknown) => {
        if (!win.isDestroyed()) {
          win.webContents.send('assistant:error', {
            requestId,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      })
      .finally(() => {
        assistantControllers.delete(requestId)
      })

    return { requestId }
  })

  ipcMain.handle(CHANNELS.ASSISTANT_CANCEL, (_event, requestId: string) => {
    const controller = assistantControllers.get(requestId)
    if (controller) {
      controller.abort()
      assistantControllers.delete(requestId)
      return { cancelled: true }
    }
    return { cancelled: false }
  })
}

/**
 * 개발용: 환경 변수에서 액세스 토큰 초기화
 */
export function initDevToken(): void {
  const token = process.env['CLIPROXY_TOKEN']
  if (token) {
    currentAccessToken = token
  }
}

/**
 * 자동 셋업 완료 후 액세스 토큰 설정
 */
export function setAccessToken(token: string): void {
  currentAccessToken = token
}
