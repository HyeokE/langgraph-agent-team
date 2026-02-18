import type { BrowserWindow } from 'electron'
import type { ModelAdapter } from '@agent-team/langgraph-team-factory'
import { ToolRepository } from '../storage/ToolRepository.js'
import { TeamRepository } from '../storage/TeamRepository.js'
import { createAssistantAgent } from './assistantAgent.js'
import type {
  AssistantContext,
  AssistantAction,
  ChatMessage
} from '../types/assistantTypes.js'

function sendToWindow(win: BrowserWindow, channel: string, data: unknown): void {
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

/**
 * AssistantAction 실행: ToolRepository / TeamRepository 조작
 */
async function executeAction(action: AssistantAction): Promise<string> {
  switch (action.type) {
    case 'createTool': {
      const tool = await ToolRepository.create(action.spec)
      return `툴 "${tool.name}" 생성 완료 (id: ${tool.id})`
    }
    case 'updateTool': {
      const tool = await ToolRepository.update(action.id, action.patch)
      return `툴 "${tool.name}" 업데이트 완료`
    }
    case 'createTeam': {
      const team = await TeamRepository.create(action.spec)
      return `팀 "${team.name}" 생성 완료 (id: ${team.id})`
    }
    case 'updateTeam': {
      const team = await TeamRepository.update(action.id, action.patch)
      return `팀 "${team.name}" 업데이트 완료`
    }
    default: {
      const exhaustive: never = action
      throw new Error(`알 수 없는 액션 타입: ${(exhaustive as { type: string }).type}`)
    }
  }
}

/**
 * 어시스턴트 메시지 처리
 * 1. AssistantAgent.run() 호출
 * 2. action 있으면 ToolRepository / TeamRepository 실행
 * 3. assistant:response / assistant:action 이벤트 emit
 */
export async function handleAssistantMessage(
  message: string,
  context: AssistantContext,
  history: ChatMessage[],
  win: BrowserWindow,
  signal: AbortSignal,
  modelAdapter: ModelAdapter
): Promise<void> {
  // 에이전트는 createTeamFactory 없이 단독 실행 (팩토리 인프라 재사용)
  const agent = createAssistantAgent(modelAdapter)

  const ctx = {
    teamId: 'assistant',
    agentId: 'assistant',
    step: 0,
    state: { message, context, history } as Record<string, unknown>,
    input: {} as Record<string, unknown>,
    routeTrace: [] as never[],
    chatHistory: [] as never[],
    model: modelAdapter,
    signal
  }

  const result = await agent.run(ctx)
  const responseState = result.state as Record<string, unknown>
  const response = responseState['response'] as { message: string; action?: AssistantAction } | undefined

  if (!response) {
    sendToWindow(win, 'assistant:response', { message: '응답을 처리할 수 없습니다.' })
    return
  }

  // action 실행
  if (response.action) {
    try {
      const actionResult = await executeAction(response.action)
      sendToWindow(win, 'assistant:action', {
        action: response.action,
        result: actionResult
      })
    } catch (err) {
      sendToWindow(win, 'assistant:error', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  sendToWindow(win, 'assistant:response', { message: response.message })
}
