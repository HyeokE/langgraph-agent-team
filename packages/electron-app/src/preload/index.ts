import { contextBridge, ipcRenderer } from 'electron'

// IPC 이벤트 채널명 (타입 안전성을 위해 상수로 관리)
const TEAM_EVENTS = ['team:step', 'team:route', 'team:complete', 'team:error', 'team:message'] as const
const ASSISTANT_EVENTS = ['assistant:response', 'assistant:action', 'assistant:error'] as const

type TeamEventChannel = (typeof TEAM_EVENTS)[number]
type AssistantEventChannel = (typeof ASSISTANT_EVENTS)[number]

function createEventSubscriber(channel: TeamEventChannel | AssistantEventChannel) {
  return (cb: (data: unknown) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data)
    ipcRenderer.on(channel, handler)
    // cleanup 함수 반환 — 렌더러에서 반드시 호출해야 메모리 누수 방지
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

/**
 * contextBridge를 통해 window.electronAPI로 노출되는 API
 * - 화이트리스트 방식: 명시적으로 허용된 채널/함수만 접근 가능
 * - 렌더러 프로세스는 Node.js API에 직접 접근 불가
 */
contextBridge.exposeInMainWorld('electronAPI', {
  teams: {
    list: () => ipcRenderer.invoke('teams:list'),
    get: (id: string) => ipcRenderer.invoke('teams:get', id),
    create: (def: unknown) => ipcRenderer.invoke('teams:create', def),
    update: (id: string, patch: unknown) => ipcRenderer.invoke('teams:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('teams:delete', id)
  },
  tools: {
    list: () => ipcRenderer.invoke('tools:list'),
    get: (id: string) => ipcRenderer.invoke('tools:get', id),
    create: (def: unknown) => ipcRenderer.invoke('tools:create', def),
    update: (id: string, patch: unknown) => ipcRenderer.invoke('tools:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('tools:delete', id)
  },
  envs: {
    list: () => ipcRenderer.invoke('envs:list'),
    set: (key: string, value: string, description?: string) =>
      ipcRenderer.invoke('envs:set', key, value, description),
    delete: (id: string) => ipcRenderer.invoke('envs:delete', id),
    listKeys: () => ipcRenderer.invoke('envs:listKeys')
  },
  execution: {
    start: (teamId: string, input: unknown) =>
      ipcRenderer.invoke('execution:start', teamId, input),
    cancel: (sessionId: string) => ipcRenderer.invoke('execution:cancel', sessionId),
    listActive: () => ipcRenderer.invoke('execution:listActive'),
    onStep: createEventSubscriber('team:step'),
    onRoute: createEventSubscriber('team:route'),
    onComplete: createEventSubscriber('team:complete'),
    onError: createEventSubscriber('team:error'),
    onMessage: createEventSubscriber('team:message')
  },
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:status'),
    login: () => ipcRenderer.invoke('auth:login'),
    setToken: (token: string) => ipcRenderer.invoke('auth:setToken', token),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  runs: {
    list: (teamId: string) => ipcRenderer.invoke('runs:list', teamId)
  },
  setup: {
    getStatus: () => ipcRenderer.invoke('setup:status'),
    onStatus: (cb: (status: unknown) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('setup:status', handler)
      return () => ipcRenderer.removeListener('setup:status', handler)
    }
  },
  assistant: {
    send: (message: string, context: unknown, history: unknown) =>
      ipcRenderer.invoke('assistant:send', message, context, history),
    cancel: (requestId: string) => ipcRenderer.invoke('assistant:cancel', requestId),
    onResponse: createEventSubscriber('assistant:response'),
    onAction: createEventSubscriber('assistant:action'),
    onError: createEventSubscriber('assistant:error')
  }
})
