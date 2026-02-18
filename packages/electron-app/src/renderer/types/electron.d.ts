import type {
  TeamDefinition,
  TeamIndexEntry,
  RunResult
} from '../../main/types/teamDefinition'
import type {
  ToolDefinition,
  ToolIndexEntry
} from '../../main/types/toolDefinition'
import type { EnvVarEntry } from '../../main/types/envDefinition'
import type { AssistantContext, ChatMessage, AssistantAction } from '../../main/types/assistantTypes'

interface AuthStatus {
  authenticated: boolean
  proxyRunning: boolean
  hasValidToken: boolean
  tokenEmail?: string
  tokenExpired?: string
}

interface ActiveSession {
  sessionId: string
  teamId: string
  startedAt: string
}

interface StartResult {
  sessionId: string
}

interface CancelResult {
  cancelled: boolean
}

type SetupStatus =
  | { stage: 'checking' }
  | { stage: 'downloading'; progress: number }
  | { stage: 'starting' }
  | { stage: 'ready'; apiKey: string }
  | { stage: 'error'; message: string }

interface AssistantActionEvent {
  action: AssistantAction
  result: string
}

interface AssistantResponseEvent {
  message: string
}

interface AssistantErrorEvent {
  error: string
  requestId?: string
}

declare global {
  interface Window {
    electronAPI: {
      teams: {
        list(): Promise<TeamIndexEntry[]>
        get(id: string): Promise<TeamDefinition | null>
        create(def: Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamDefinition>
        update(id: string, patch: Partial<TeamDefinition>): Promise<TeamDefinition>
        delete(id: string): Promise<{ success: boolean }>
      }
      tools: {
        list(): Promise<ToolIndexEntry[]>
        get(id: string): Promise<ToolDefinition | null>
        create(def: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolDefinition>
        update(id: string, patch: Partial<ToolDefinition>): Promise<ToolDefinition>
        delete(id: string): Promise<{ success: boolean }>
      }
      envs: {
        list(): Promise<EnvVarEntry[]>
        set(key: string, value: string, description?: string): Promise<EnvVarEntry>
        delete(id: string): Promise<{ success: boolean }>
        listKeys(): Promise<string[]>
      }
      execution: {
        start(teamId: string, input: Record<string, unknown>): Promise<StartResult>
        cancel(sessionId: string): Promise<CancelResult>
        listActive(): Promise<ActiveSession[]>
        onStep(cb: (data: unknown) => void): () => void
        onRoute(cb: (data: unknown) => void): () => void
        onComplete(cb: (data: unknown) => void): () => void
        onError(cb: (data: unknown) => void): () => void
        onMessage(cb: (data: unknown) => void): () => void
      }
      auth: {
        getStatus(): Promise<AuthStatus>
        login(): Promise<void>
        setToken(token: string): Promise<{ success: boolean }>
        logout(): Promise<{ success: boolean }>
      }
      runs: {
        list(teamId: string): Promise<RunResult[]>
      }
      setup: {
        getStatus(): Promise<{ proxyRunning: boolean; hasApiKey: boolean }>
        onStatus(cb: (status: SetupStatus) => void): () => void
      }
      assistant: {
        send(message: string, context: AssistantContext, history: ChatMessage[]): Promise<{ requestId: string }>
        cancel(requestId: string): Promise<{ cancelled: boolean }>
        onResponse(cb: (data: AssistantResponseEvent) => void): () => void
        onAction(cb: (data: AssistantActionEvent) => void): () => void
        onError(cb: (data: AssistantErrorEvent) => void): () => void
      }
    }
  }
}

export {}
