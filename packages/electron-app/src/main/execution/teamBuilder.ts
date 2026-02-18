import { z } from 'zod'
import {
  createTeamFactory,
  createDeclarativeAgent,
  type AgentTeam,
  type AgentContext,
  type AgentResult,
  type ModelAdapter
} from '@agent-team/langgraph-team-factory'
import { buildStateSchema, buildInitialState } from '../storage/schemaBuilder.js'
import { buildDeclarativeTool } from './toolExecutor.js'
import type { TeamDefinition, AgentDefinition } from '../types/teamDefinition.js'
import type { ToolDefinition } from '../types/toolDefinition.js'
import type { EnvStore } from '../storage/EnvStore.js'

// Supervisor 라우팅 결정 스키마
function buildRoutingSchema(agentIds: string[]) {
  const validTargets: [string, ...string[]] = ['__end__', ...agentIds]
  return {
    schema: z.object({
      reasoning: z.string(),
      next: z.enum(validTargets)
    }),
    validTargets
  }
}

/**
 * 텍스트에서 유효한 에이전트 ID를 추출하는 폴백 함수
 */
function extractAgentIdFallback(text: string, validTargets: string[]): string {
  const lower = text.trim().toLowerCase()
  // 긴 ID부터 매칭 시도 (부분 일치 방지)
  const sorted = [...validTargets].sort((a, b) => b.length - a.length)
  const found = sorted.find((id) => lower.includes(id.toLowerCase()))
  return found ?? '__end__'
}

/**
 * AgentDefinition을 DeclarativeAgent로 변환
 */
type S = Record<string, unknown>

function buildWorkerAgent(
  def: AgentDefinition,
  stateFields: TeamDefinition['stateFields'],
  toolsById: Map<string, ToolDefinition>,
  envStore: typeof EnvStore
) {
  const fieldNames = stateFields.map((f) => f.name).join(', ')

  // 에이전트에 할당된 툴 빌드 (설정/API 키는 execute 클로저 안에만 존재)
  const tools = (def.toolIds ?? [])
    .map((id) => toolsById.get(id))
    .filter((t): t is ToolDefinition => t !== undefined)
    .map((t) => buildDeclarativeTool(t, envStore))

  const baseAgent = createDeclarativeAgent<S, S, S>({
    id: def.id,
    description: def.role,
    tools,
    toolErrorMode: 'continue',
    prompt: {
      system: def.systemPrompt,
      user: (ctx) => {
        const stateJson = JSON.stringify(ctx.state, null, 2)
        return [
          `당신의 역할: ${def.role}`,
          `현재 상태:\n${stateJson}`,
          `분석 결과를 "${def.outputField}" 필드에 저장할 수 있는 형태로 응답하세요.`,
          `응답 후 상태 필드: ${fieldNames}`
        ].join('\n\n')
      }
    },
    stateResolver: (envelope) => {
      const state = envelope.ctx.state as Record<string, unknown>
      return {
        ...state,
        [def.outputField]: envelope.text
      } as typeof state
    },
    retry: { attempts: 2, backoffMs: 300 }
  })

  // 에이전트 응답을 채팅 메시지로 게시하기 위해 message 필드 주입
  return {
    id: baseAgent.id,
    description: baseAgent.description,
    async run(ctx: AgentContext<S, S>): Promise<AgentResult<S, S>> {
      const result = await baseAgent.run(ctx)
      const content = String(
        (result.state as Record<string, unknown>)[def.outputField] ?? ''
      )
      return {
        ...result,
        message: {
          agentId: def.id,
          agentName: def.role,
          content,
          mentions: []
        }
      }
    }
  }
}

/**
 * Supervisor 에이전트 생성 (Structured Output 기반 라우팅)
 */
function buildSupervisorAgent(def: TeamDefinition) {
  const agentIds = def.agents.map((a) => a.id)
  const { schema: routingSchema, validTargets } = buildRoutingSchema(agentIds)
  const agentDescriptions = def.agents
    .map((a) => `- ${a.id}: ${a.role}`)
    .join('\n')

  return createDeclarativeAgent<S, S, S, { reasoning: string; next: string }>({
    id: def.supervisor.id,
    description: 'Supervisor - 다음 에이전트를 결정합니다',
    prompt: {
      system: def.supervisor.systemPrompt,
      user: (ctx) => {
        const stateJson = JSON.stringify(ctx.state, null, 2)
        const targetList = validTargets.join('" | "')
        return [
          `현재 상태:\n${stateJson}`,
          `사용 가능한 에이전트:\n${agentDescriptions}`,
          `반드시 아래 JSON 형식으로만 응답하세요:`,
          `{"reasoning": "...", "next": "${targetList}"}`
        ].join('\n\n')
      }
    },
    responseSchema: routingSchema,
    decisionResolver: ({ parsed, text }) => ({
      next: parsed?.next ?? extractAgentIdFallback(text, validTargets)
    }),
    retry: { attempts: 2, backoffMs: 300 }
  })
}

/**
 * TeamDefinition을 실행 가능한 AgentTeam으로 변환
 */
export function buildTeam(
  def: TeamDefinition,
  modelAdapter: ModelAdapter,
  toolsById: Map<string, ToolDefinition> = new Map(),
  envStore: typeof EnvStore
): AgentTeam<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> {
  const stateSchema = buildStateSchema(def.stateFields)
  const initialState = buildInitialState(def.stateFields)

  const factory = createTeamFactory<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >({
    stateSchema,
    modelAdapter,
    validationMode: 'input-only'
  })

  const supervisor = buildSupervisorAgent(def)
  const agents = def.agents.map((agentDef) =>
    buildWorkerAgent(agentDef, def.stateFields, toolsById, envStore)
  )

  const team = factory.createTeam({
    teamId: def.id,
    supervisor,
    agents,
    termination: {
      maxSteps: def.maxSteps,
      isDone: (state) => {
        // __end__ 라우팅으로 종료 조건을 결정하므로 항상 false 반환
        // (실제 종료는 supervisor의 decisionResolver에서 next: '__end__' 반환 시 발생)
        void state
        return false
      }
    },
    inputToState: (input) => ({
      ...initialState,
      ...input
    })
  })

  return team
}
