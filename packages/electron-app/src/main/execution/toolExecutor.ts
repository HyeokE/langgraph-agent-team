import { net } from 'electron'
import type { AgentContext } from '@agent-team/langgraph-team-factory'
import type { DeclarativeAgentTool } from '@agent-team/langgraph-team-factory'
import type { ToolDefinition, HttpToolConfig, ScriptToolConfig } from '../types/toolDefinition.js'
import type { EnvStore } from '../storage/EnvStore.js'

type S = Record<string, unknown>
type EnvStoreType = typeof EnvStore

// {{state.fieldName}} 또는 {{env.KEY_NAME}} 패턴 매칭
const TEMPLATE_PATTERN = /\{\{(state|env)\.([^}]+)\}\}/g

/**
 * 템플릿 문자열에서 사용된 env 키 이름 추출
 */
function extractEnvKeys(template: string): string[] {
  const keys: string[] = []
  let match: RegExpExecArray | null
  const pattern = /\{\{env\.([^}]+)\}\}/g
  while ((match = pattern.exec(template)) !== null) {
    if (match[1]) keys.push(match[1])
  }
  return [...new Set(keys)]
}

/**
 * 템플릿 문자열의 모든 env 키를 미리 복호화
 */
async function preloadEnvValues(
  template: string,
  envStore: EnvStoreType
): Promise<Record<string, string>> {
  const keys = extractEnvKeys(template)
  const entries = await Promise.all(
    keys.map(async (key) => {
      const value = await envStore.resolve(key)
      return [key, value ?? ''] as const
    })
  )
  return Object.fromEntries(entries)
}

/**
 * 여러 템플릿에서 사용된 env 키를 모두 수집하여 일괄 복호화
 */
async function preloadEnvValuesForConfig(
  templates: (string | undefined)[],
  envStore: EnvStoreType
): Promise<Record<string, string>> {
  const allKeys = new Set<string>()
  for (const t of templates) {
    if (t) extractEnvKeys(t).forEach((k) => allKeys.add(k))
  }
  const entries = await Promise.all(
    [...allKeys].map(async (key) => {
      const value = await envStore.resolve(key)
      return [key, value ?? ''] as const
    })
  )
  return Object.fromEntries(entries)
}

/**
 * 템플릿 치환: {{state.field}} → state 값, {{env.KEY}} → 미리 로드된 env 값
 */
function resolveTemplate(
  template: string,
  state: Record<string, unknown>,
  preloadedEnv: Record<string, string>
): string {
  return template.replace(TEMPLATE_PATTERN, (_match, source: string, key: string) => {
    if (source === 'state') {
      const value = state[key]
      return value !== undefined ? String(value) : ''
    }
    if (source === 'env') {
      return preloadedEnv[key] ?? ''
    }
    return ''
  })
}

/**
 * HTTP 툴 실행 (electron.net.fetch 사용 — 시스템 프록시 자동 반영)
 */
async function executeHttpTool(
  config: HttpToolConfig,
  ctx: AgentContext<S, S>,
  envStore: EnvStoreType
): Promise<string> {
  const state = ctx.state as Record<string, unknown>

  // 모든 템플릿에서 env 키를 수집하여 일괄 복호화
  const allTemplates = [
    config.url,
    config.body,
    ...Object.values(config.headers ?? {})
  ]
  const preloadedEnv = await preloadEnvValuesForConfig(allTemplates, envStore)

  const resolvedUrl = resolveTemplate(config.url, state, preloadedEnv)

  const resolvedHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(config.headers ?? {})) {
    resolvedHeaders[k] = resolveTemplate(v, state, preloadedEnv)
  }

  const resolvedBody = config.body
    ? resolveTemplate(config.body, state, preloadedEnv)
    : undefined

  const response = await net.fetch(resolvedUrl, {
    method: config.method,
    headers: resolvedHeaders,
    body: resolvedBody,
    signal: ctx.signal
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${resolvedUrl}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()

  // JSON 응답은 그대로 반환, 아닌 경우도 텍스트로 반환
  if (contentType.includes('application/json')) {
    try {
      return JSON.stringify(JSON.parse(text))
    } catch {
      return text
    }
  }

  return text
}

/**
 * Script 툴 실행 (new Function + AsyncFunction 패턴)
 * - env는 미리 복호화된 객체로 전달 (동기 접근 가능)
 * - state, input은 직접 전달
 * - require, fs 등 Node.js API 접근 불가 (격리 보장)
 */
async function executeScriptTool(
  config: ScriptToolConfig,
  ctx: AgentContext<S, S>,
  envStore: EnvStoreType
): Promise<string> {
  const state = ctx.state as Record<string, unknown>
  const input = ctx.input as Record<string, unknown>

  // 코드에서 사용하는 env 키 미리 복호화
  const preloadedEnv = await preloadEnvValuesForConfig([config.code], envStore)

  // AsyncFunction으로 await 사용 가능
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<unknown>

  const fn = new AsyncFunction(
    'state',
    'input',
    'env',
    '"use strict";\n' + config.code
  )

  const result = await fn(state, input, preloadedEnv)
  return result !== undefined ? String(result) : ''
}

/**
 * ToolDefinition → DeclarativeAgentTool 변환
 * 에이전트는 툴 설정(URL, 헤더, API 키)을 절대 볼 수 없고 실행 결과(output)만 받음
 */
export function buildDeclarativeTool(
  def: ToolDefinition,
  envStore: EnvStoreType
): DeclarativeAgentTool<S, S> {
  return {
    name: def.name,
    description: def.description,
    async execute(ctx: AgentContext<S, S>): Promise<string> {
      const { config } = def

      if (config.type === 'http') {
        return executeHttpTool(config, ctx, envStore)
      }

      if (config.type === 'script') {
        return executeScriptTool(config, ctx, envStore)
      }

      throw new Error(`알 수 없는 툴 타입: ${(config as { type: string }).type}`)
    }
  }
}
