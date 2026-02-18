import { createDeclarativeAgent } from '@agent-team/langgraph-team-factory'
import type { ModelAdapter } from '@agent-team/langgraph-team-factory'
import type { AssistantContext, AssistantResponse, ChatMessage } from '../types/assistantTypes.js'

type S = Record<string, unknown>

/**
 * AI 어시스턴트 에이전트
 * - 사용 가능한 ENV 키 이름을 알고 {{env.KEY}} 문법을 활용한 툴 생성
 * - 응답은 JSON: { message, action? }
 */
export function createAssistantAgent(modelAdapter: ModelAdapter) {
  const systemPrompt = `당신은 Agent Team Manager의 AI 어시스턴트입니다.
사용자가 에이전트 팀, 툴 생성을 도울 수 있습니다.

## 툴 생성 원칙

**공개 API는 인증 없이 직접 호출합니다.**
- Binance 공개 시세: GET https://api.binance.com/api/v3/ticker/price?symbol={{state.symbol}}
- 날씨, 환율, 뉴스 등 공개 API: 별도 인증 불필요
- 인증이 필요한 경우에만 {{env.API_KEY}} 사용

**에이전트 상태 값은 {{state.fieldName}} 으로 참조합니다.**
- 예: symbol 필드를 사용하는 URL → ?symbol={{state.symbol}}

**환경 변수(env)는 반드시 필요한 경우에만 사용합니다.**
- {{env.KEY_NAME}}: API 키, 비밀 토큰 등 민감 정보만
- 공개 API, 고정 파라미터 등에는 사용하지 않음

**Script 툴:**
- state 객체: 에이전트 현재 상태 (예: state.symbol)
- env 객체: 환경 변수 (필요한 경우만)
- return 문으로 결과 반환 (문자열 변환됨)

## 응답 형식

반드시 아래 JSON 형식으로만 응답하세요:
{
  "message": "사용자에게 전달할 메시지 (한국어)",
  "action": {  // 선택적 — 실제 변경이 필요한 경우에만 포함
    "type": "createTool" | "updateTool" | "createTeam" | "updateTeam"
  }
}

action이 없는 경우: { "message": "..." }
action이 있는 경우 message에 무엇을 생성/수정했는지 설명하세요.`

  return createDeclarativeAgent<S, S, S, AssistantResponse>({
    id: 'assistant',
    description: 'AI 어시스턴트 — 툴/팀 생성 도우미',
    prompt: {
      system: systemPrompt,
      user: (ctx) => {
        const state = ctx.state as {
          message: string
          context: AssistantContext
          history: ChatMessage[]
        }

        const historyText = state.history
          .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
          .join('\n')

        const team = state.context.currentTeam
        const teamText = team
          ? [
              `현재 팀: ${team.name}${team.description ? ` — ${team.description}` : ''}`,
              `카테고리: ${team.category}`,
              `최대 스텝: ${team.maxSteps}`,
              `상태 필드: ${team.stateFields.map((f) => `${f.name}(${f.type})`).join(', ')}`,
              `Supervisor 프롬프트: ${team.supervisor.systemPrompt}`,
              `에이전트(${team.agents.length}명):\n${team.agents
                .map(
                  (a) =>
                    `  - ${a.name} [role: ${a.role}] outputField=${a.outputField}` +
                    (a.toolIds && a.toolIds.length > 0
                      ? ` tools=[${a.toolIds.join(', ')}]`
                      : ' tools=없음') +
                    `\n    systemPrompt: ${a.systemPrompt}`
                )
                .join('\n')}`
            ].join('\n')
          : ''

        const contextText = [
          state.context.availableEnvKeys.length > 0
            ? `사용 가능한 ENV 키: ${state.context.availableEnvKeys.join(', ')}`
            : '등록된 ENV 키 없음',
          state.context.toolLibrary.length > 0
            ? `등록된 툴: ${state.context.toolLibrary.map((t) => `${t.name}(${t.type})`).join(', ')}`
            : '등록된 툴 없음',
          teamText,
          state.context.lastRunError
            ? `마지막 오류: ${state.context.lastRunError}`
            : ''
        ]
          .filter(Boolean)
          .join('\n')

        return [
          historyText ? `대화 히스토리:\n${historyText}` : '',
          `컨텍스트:\n${contextText}`,
          `사용자 요청: ${state.message}`
        ]
          .filter(Boolean)
          .join('\n\n')
      }
    },
    parseResponse: (text) => {
      const trimmed = text.trim()
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return { message: text }

      try {
        return JSON.parse(jsonMatch[0]) as AssistantResponse
      } catch {
        return { message: text }
      }
    },
    stateResolver: (envelope) => ({
      ...(envelope.ctx.state as Record<string, unknown>),
      response: envelope.parsed ?? { message: envelope.text }
    }),
    retry: { attempts: 2, backoffMs: 500 }
  })
}
