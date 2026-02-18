import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuidv4 } from 'uuid'

const APP_DIR = join(homedir(), '.agent-team')
const CLIPROXY_DIR = join(APP_DIR, 'cliproxy')
const CLIPROXY_CONFIG_PATH = join(CLIPROXY_DIR, 'config.yaml')
const API_KEY_PATH = join(CLIPROXY_DIR, 'api-key.txt')

const CODEX_DIR = join(homedir(), '.codex')
const CODEX_CONFIG_PATH = join(CODEX_DIR, 'config.toml')

// 우리 앱 전용 포트 (Homebrew CLIProxyAPI 기본 8317과 분리)
const PROXY_PORT = 8318

// ─── CLIProxyAPI config.yaml ────────────────────────────────────────────────

/**
 * CLIProxyAPI config.yaml을 생성합니다. 이미 존재하면 건너뜁니다.
 */
export async function ensureClipProxyConfig(apiKey: string): Promise<string> {
  await fs.mkdir(CLIPROXY_DIR, { recursive: true })

  const config = `# Agent Team Manager - CLIProxyAPI 자동 생성 설정
port: ${PROXY_PORT}
auth-dir: "~/.cli-proxy-api"

api-keys:
  - "${apiKey}"

debug: false
routing:
  strategy: "round-robin"
`

  // 포트가 올바른지 확인 — 틀리면 전체 재생성 (자동 생성 파일이므로 덮어써도 무방)
  let needsRewrite = true
  try {
    const existing = await fs.readFile(CLIPROXY_CONFIG_PATH, 'utf-8')
    if (existing.includes(`port: ${PROXY_PORT}`) && existing.includes(apiKey)) {
      needsRewrite = false
    }
  } catch {
    // 파일 없음 — 새로 생성
  }

  if (needsRewrite) {
    await fs.writeFile(CLIPROXY_CONFIG_PATH, config, 'utf-8')
  }

  return CLIPROXY_CONFIG_PATH
}

// ─── API Key 관리 ─────────────────────────────────────────────────────────────

/**
 * 앱 전용 API 키를 반환합니다. 없으면 새로 생성합니다.
 */
export async function getOrCreateApiKey(): Promise<string> {
  await fs.mkdir(CLIPROXY_DIR, { recursive: true })

  try {
    const existing = await fs.readFile(API_KEY_PATH, 'utf-8')
    return existing.trim()
  } catch {
    const newKey = `atm-${uuidv4()}`
    await fs.writeFile(API_KEY_PATH, newKey, 'utf-8')
    return newKey
  }
}

// ─── ~/.codex/config.toml 관리 ───────────────────────────────────────────────

const CLIPROXY_TOML_SECTION = `
# ── Agent Team Manager (자동 추가) ──────────────────
model_provider = "cliproxyapi"
model = "gpt-5-codex"
model_reasoning_effort = "xhigh"

[model_providers.cliproxyapi]
name = "cliproxyapi"
base_url = "http://127.0.0.1:${PROXY_PORT}/v1"
wire_api = "responses"
# ────────────────────────────────────────────────────
`

const CLIPROXY_SECTION_MARKER = '[model_providers.cliproxyapi]'

/**
 * ~/.codex/config.toml에 cliproxyapi 설정을 병합합니다.
 * - 파일이 없으면 새로 생성
 * - 이미 cliproxyapi 섹션이 있으면 건너뜀
 * - 기존 설정은 보존
 */
export async function ensureCodexConfig(): Promise<void> {
  await fs.mkdir(CODEX_DIR, { recursive: true })

  let existing = ''
  try {
    existing = await fs.readFile(CODEX_CONFIG_PATH, 'utf-8')
  } catch {
    // 파일이 없으면 빈 문자열로 시작
  }

  // 이미 cliproxyapi 섹션이 있으면 건너뜀
  if (existing.includes(CLIPROXY_SECTION_MARKER)) {
    return
  }

  // 기존 내용 뒤에 섹션 추가 (불변 방식)
  const updated = existing + CLIPROXY_TOML_SECTION
  await fs.writeFile(CODEX_CONFIG_PATH, updated, 'utf-8')
}

export { CLIPROXY_CONFIG_PATH, CODEX_CONFIG_PATH }
