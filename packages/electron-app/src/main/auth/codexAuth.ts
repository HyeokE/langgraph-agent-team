/**
 * Codex OAuth 로그인 (OpenAI via Google OAuth)
 *
 * CLIProxyAPI 바이너리의 --codex-login --no-browser 플래그를 활용해
 * Electron BrowserWindow에서 OAuth 플로우를 실행합니다.
 *
 * 흐름:
 * 1. `cliproxyapi --codex-login --no-browser` 실행 → 포트 1455 서버 시작 + URL 출력
 * 2. BrowserWindow에서 OAuth URL 로드 (프로세스는 계속 실행 중)
 * 3. 사용자 로그인 → Google redirect → localhost:1455/callback
 * 4. CLIProxyAPI 프로세스가 콜백 처리 → 토큰 저장 → 자연 종료
 * 5. 프로세스 종료 감지 → 토큰 파일 읽기 → 반환
 */

import { BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CLIPROXY_AUTH_DIR = join(homedir(), '.cli-proxy-api')

// Homebrew 설치 경로 (Apple Silicon: /opt/homebrew, Intel: /usr/local)
const HOMEBREW_BINARY_PATHS = [
  '/opt/homebrew/opt/cliproxyapi/bin/cliproxyapi',
  '/usr/local/opt/cliproxyapi/bin/cliproxyapi'
]

export interface CodexTokenInfo {
  email: string
  plan: string
  expired: string
  accountId?: string
}

/**
 * ~/.cli-proxy-api/codex-*.json 에서 토큰 정보를 읽습니다.
 */
export async function getCodexTokenInfo(): Promise<CodexTokenInfo | null> {
  try {
    const files = await fs.readdir(CLIPROXY_AUTH_DIR)
    const tokenFiles = files
      .filter((f) => f.startsWith('codex-') && f.endsWith('.json'))
      .sort()
      .reverse() // 최신 파일 우선

    for (const file of tokenFiles) {
      try {
        const content = await fs.readFile(join(CLIPROXY_AUTH_DIR, file), 'utf-8')
        const data = JSON.parse(content) as Record<string, unknown>

        if (typeof data.email !== 'string' || typeof data.expired !== 'string') continue

        return {
          email: data.email,
          plan: typeof data.type === 'string' ? data.type : 'unknown',
          expired: data.expired,
          accountId: typeof data.account_id === 'string' ? data.account_id : undefined
        }
      } catch {
        continue
      }
    }
  } catch {
    // auth dir doesn't exist
  }
  return null
}

/**
 * 토큰이 현재 유효한지 확인합니다.
 */
export function isTokenValid(info: CodexTokenInfo): boolean {
  try {
    const expiresAt = new Date(info.expired)
    // 5분 여유를 두고 만료 체크
    return expiresAt.getTime() - Date.now() > 5 * 60 * 1000
  } catch {
    return false
  }
}

/**
 * 사용 가능한 Homebrew CLIProxyAPI 바이너리 경로를 찾습니다.
 */
async function findHomebrewBinary(): Promise<string | null> {
  for (const binaryPath of HOMEBREW_BINARY_PATHS) {
    try {
      await fs.access(binaryPath)
      return binaryPath
    } catch {
      continue
    }
  }
  return null
}

/**
 * CLIProxyAPI --codex-login 플로우를 Electron BrowserWindow에서 실행합니다.
 *
 * 중요: URL 감지 후에도 프로세스를 kill하면 안 됩니다.
 * 프로세스는 포트 1455에서 OAuth 콜백을 기다리고,
 * 콜백 수신 후 토큰을 저장한 뒤 자연 종료됩니다.
 */
export async function triggerCodexLogin(parentWin: BrowserWindow): Promise<CodexTokenInfo> {
  const binaryPath = await findHomebrewBinary()
  if (!binaryPath) {
    throw new Error(
      'CLIProxyAPI가 설치되어 있지 않습니다. brew install cliproxyapi 를 실행하세요.'
    )
  }

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn(binaryPath, ['--codex-login', '--no-browser'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let authWin: BrowserWindow | null = null
    let output = ''
    let done = false

    const finish = (result: CodexTokenInfo | Error): void => {
      if (done) return
      done = true
      if (authWin && !authWin.isDestroyed()) authWin.close()
      if (!proc.killed) proc.kill()
      if (result instanceof Error) reject(result)
      else resolve(result)
    }

    // URL 감지 → BrowserWindow 열기 (프로세스는 계속 실행 - 포트 1455 콜백 대기 중)
    const onData = (data: Buffer): void => {
      output += data.toString()
      const urlMatch = output.match(/https:\/\/[^\s\n]+/)
      if (urlMatch && !authWin) {
        authWin = new BrowserWindow({
          width: 500,
          height: 700,
          parent: parentWin,
          modal: true,
          title: 'OpenAI 로그인',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        })

        authWin.on('closed', () => {
          if (!done) finish(new Error('로그인 창이 닫혔습니다.'))
        })

        void authWin.loadURL(urlMatch[0])
      }
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

    // 프로세스 종료 = OAuth 완료 (code=0) 또는 에러
    proc.on('exit', (code) => {
      if (done) return
      if (code === 0 || code === null) {
        // 토큰이 저장됐는지 확인
        getCodexTokenInfo()
          .then((info) => {
            if (info) finish(info)
            else finish(new Error('로그인은 완료됐으나 토큰 파일을 찾을 수 없습니다.'))
          })
          .catch((err: unknown) =>
            finish(err instanceof Error ? err : new Error(String(err)))
          )
      } else {
        finish(new Error(`로그인 실패 (exit code ${code})`))
      }
    })

    proc.on('error', (err) => finish(err))

    // 5분 타임아웃 (로그인 완료 대기)
    setTimeout(() => finish(new Error('로그인 타임아웃 (5분)')), 5 * 60 * 1000)
  })
}
