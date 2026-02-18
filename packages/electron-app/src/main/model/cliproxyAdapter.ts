import type { ModelAdapter, ModelRequest, ModelResponse } from '@agent-team/langgraph-team-factory'

// 우리 앱 전용 포트 (Homebrew CLIProxyAPI 기본 8317과 분리)
const CLIPROXY_BASE_URL = 'http://127.0.0.1:8318/v1'
const DEFAULT_MODEL = 'gpt-5-codex'
// OpenAI Responses API reasoning.effort 값: "low" | "medium" | "high"
const DEFAULT_REASONING_EFFORT = 'high'

export interface ClipProxyAdapterOptions {
  /** CLIProxyAPI API 키 */
  accessToken: string
  /** 모델 ID (기본값: gpt-5-codex) */
  model?: string
  /** reasoning effort (기본값: high) */
  reasoningEffort?: string
  /** 요청 취소용 AbortSignal */
  signal?: AbortSignal
}

interface ResponsesApiMessage {
  role: string
  content: string
}

interface ResponsesApiRequest {
  model: string
  reasoning: { effort: string }
  input: ResponsesApiMessage[]
}

interface ResponsesApiOutput {
  type: string
  content?: Array<{ type: string; text: string }>
}

interface ResponsesApiResponse {
  id: string
  output: ResponsesApiOutput[]
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * CLIProxyAPI ModelAdapter 구현체.
 *
 * CLIProxyAPI는 http://127.0.0.1:8318 에서 실행 중인 로컬 프록시로,
 * Google OAuth 인증을 통해 ChatGPT Pro(gpt-5-codex)에 접근합니다.
 * OpenAI Responses API wire format 사용:
 * - POST /v1/responses
 * - body: { model, reasoning: { effort }, input: [{role, content}] }
 * - Authorization: Bearer <atm-uuid API key>
 */
export function createClipProxyAdapter(options: ClipProxyAdapterOptions): ModelAdapter {
  const {
    accessToken,
    model = DEFAULT_MODEL,
    reasoningEffort = DEFAULT_REASONING_EFFORT,
    signal
  } = options

  return {
    async invoke(request: ModelRequest): Promise<ModelResponse> {
      // prompt를 Responses API 형식의 메시지로 변환
      const input: ResponsesApiMessage[] = [
        { role: 'user', content: request.prompt }
      ]

      const body: ResponsesApiRequest = {
        model,
        reasoning: { effort: reasoningEffort },
        input
      }

      let response: Response
      try {
        response = await fetch(`${CLIPROXY_BASE_URL}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(body),
          signal
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(
          `cliproxyapi 연결 실패 (${CLIPROXY_BASE_URL}). 프록시 실행 상태를 확인하세요: ${reason}`
        )
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `cliproxyapi request failed [${response.status}]: ${errorText}`
        )
      }

      const data = (await response.json()) as ResponsesApiResponse

      // output에서 텍스트 추출
      const text = extractText(data)

      return {
        text,
        raw: data,
        usage: data.usage
          ? {
              inputTokens: data.usage.input_tokens,
              outputTokens: data.usage.output_tokens
            }
          : undefined
      }
    }
  }
}

function extractText(data: ResponsesApiResponse): string {
  for (const output of data.output) {
    if (output.content) {
      for (const part of output.content) {
        // OpenAI Responses API: type은 'output_text' (message output)
        if ((part.type === 'output_text' || part.type === 'text') && part.text) {
          return part.text
        }
      }
    }
  }
  return ''
}

/**
 * cliproxyapi 서버 상태 확인
 * - 200: 정상 동작
 * - 401: Google OAuth 인증 필요
 * - 오류: 서버 미실행
 */
export async function checkClipProxyHealth(): Promise<'ok' | 'auth_required' | 'unavailable'> {
  try {
    const response = await fetch(`http://127.0.0.1:8318/v1/models`, {
      signal: AbortSignal.timeout(3000)
    })

    if (response.ok) return 'ok'
    if (response.status === 401) return 'auth_required'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}
