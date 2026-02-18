import { spawn, type ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { homedir, platform, arch } from 'os'
const VERSION = 'v6.8.18'
const APP_BIN_DIR = join(homedir(), '.agent-team', 'bin')
// 아카이브 내 실제 바이너리 이름 (tar -tzf 로 확인: cli-proxy-api)
const BINARY_NAME = process.platform === 'win32' ? 'cli-proxy-api.exe' : 'cli-proxy-api'
const BINARY_PATH = join(APP_BIN_DIR, BINARY_NAME)

// 우리 앱 전용 포트 (Homebrew CLIProxyAPI의 기본 8317과 충돌 방지)
export const APP_PROXY_PORT = 8318

export type SetupStatus =
  | { stage: 'checking' }
  | { stage: 'downloading'; progress: number }
  | { stage: 'starting' }
  | { stage: 'ready'; apiKey: string }
  | { stage: 'error'; message: string }

type StatusListener = (status: SetupStatus) => void

/**
 * 현재 플랫폼/아키텍처에 맞는 GitHub Release 다운로드 URL을 반환합니다.
 */
function getDownloadUrl(): string {
  const os = platform()
  const cpu = arch()

  const osMap: Record<string, string> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows'
  }
  const archMap: Record<string, string> = {
    arm64: 'arm64',
    x64: 'amd64'
  }

  const osStr = osMap[os]
  const archStr = archMap[cpu]

  if (!osStr || !archStr) {
    throw new Error(`Unsupported platform: ${os}/${cpu}`)
  }

  const ext = os === 'win32' ? 'zip' : 'tar.gz'
  const fileName = `CLIProxyAPI_${VERSION.replace('v', '')}_${osStr}_${archStr}.${ext}`
  return `https://github.com/router-for-me/CLIProxyAPI/releases/download/${VERSION}/${fileName}`
}

/**
 * CLIProxyAPI 바이너리가 설치되어 있는지 확인합니다.
 */
async function isBinaryInstalled(): Promise<boolean> {
  try {
    await fs.access(BINARY_PATH)
    return true
  } catch {
    return false
  }
}

/**
 * CLIProxyAPI 바이너리를 다운로드합니다.
 */
async function downloadBinary(onProgress: (progress: number) => void): Promise<void> {
  await fs.mkdir(APP_BIN_DIR, { recursive: true })

  const url = getDownloadUrl()
  const archiveExt = process.platform === 'win32' ? '.zip' : '.tar.gz'
  const archivePath = BINARY_PATH + archiveExt

  // 다운로드
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) {
    throw new Error(`Download failed [${response.status}]: ${url}`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  let downloaded = 0

  const writeStream = createWriteStream(archivePath)
  const reader = response.body!.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writeStream.write(value)
    downloaded += value.byteLength
    if (contentLength > 0) {
      onProgress(Math.round((downloaded / contentLength) * 90))
    }
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end((err: Error | null) => (err ? reject(err) : resolve()))
  })

  // 압축 해제
  onProgress(92)
  await extractArchive(archivePath, APP_BIN_DIR)

  // 임시 파일 정리
  await fs.rm(archivePath, { force: true })

  // 실행 권한 부여 (Unix)
  if (process.platform !== 'win32') {
    await fs.chmod(BINARY_PATH, 0o755)
  }

  onProgress(100)
}

/**
 * tar.gz 또는 zip 아카이브에서 바이너리를 추출합니다.
 */
// 패키징된 앱에서도 동작하도록 절대 경로 사용
// 패키징된 macOS 앱의 PATH는 최소화되어 있어 단순 명령어 이름으로 찾지 못할 수 있음
const TAR_BIN =
  process.platform === 'darwin'
    ? '/usr/bin/tar'
    : process.platform === 'linux'
      ? '/bin/tar'
      : 'tar' // Windows는 PATH에서 찾기

const UNZIP_BIN =
  process.platform === 'darwin'
    ? '/usr/bin/unzip'
    : process.platform === 'linux'
      ? '/usr/bin/unzip'
      : 'unzip'

/**
 * tar.gz 또는 zip 아카이브에서 바이너리를 추출합니다.
 */
async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)

  if (archivePath.endsWith('.tar.gz')) {
    await execFileAsync(TAR_BIN, ['xzf', archivePath, '-C', destDir, BINARY_NAME])
  } else if (archivePath.endsWith('.zip')) {
    await execFileAsync(UNZIP_BIN, ['-o', archivePath, BINARY_NAME, '-d', destDir])
  } else {
    throw new Error(`Unknown archive format: ${archivePath}`)
  }
}

/**
 * CLIProxyAPI가 http://127.0.0.1:8317 에서 응답 중인지 확인합니다.
 */
export async function isProxyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${APP_PROXY_PORT}/v1/models`, {
      signal: AbortSignal.timeout(2000)
    })
    return res.status === 200 || res.status === 401
  } catch {
    return false
  }
}

// 전역 프로세스 참조 (앱 종료 시 정리용)
let proxyProcess: ChildProcess | null = null

/**
 * CLIProxyAPI 프로세스를 시작합니다.
 */
function startProcess(configPath: string): ChildProcess {
  const proc = spawn(BINARY_PATH, ['--config', configPath], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  proc.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[CLIProxy] ${data.toString()}`)
  })
  proc.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[CLIProxy] ${data.toString()}`)
  })

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`[CLIProxy] exited with code ${code}\n`)
    }
    proxyProcess = null
  })

  return proc
}

/**
 * 프록시가 준비될 때까지 폴링합니다 (최대 15초).
 */
async function waitForProxy(timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isProxyRunning()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('CLIProxyAPI did not start within 15 seconds')
}

/**
 * CLIProxyAPI 자동 세팅 + 시작의 전체 플로우.
 * 상태 변경마다 listener를 호출합니다.
 * 우리 앱 전용 포트(APP_PROXY_PORT)에서만 동작합니다.
 */
export async function ensureClipProxy(
  configPath: string,
  apiKey: string,
  onStatus: StatusListener
): Promise<void> {
  onStatus({ stage: 'checking' })

  // 우리 앱 전용 포트에서 이미 실행 중이면 재사용
  if (await isProxyRunning()) {
    onStatus({ stage: 'ready', apiKey })
    return
  }

  // 바이너리 설치 확인
  if (!(await isBinaryInstalled())) {
    await downloadBinary((progress) => {
      onStatus({ stage: 'downloading', progress })
    })
  }

  // 프로세스 시작
  onStatus({ stage: 'starting' })
  proxyProcess = startProcess(configPath)

  await waitForProxy()
  onStatus({ stage: 'ready', apiKey })
}

/**
 * CLIProxyAPI 프로세스를 정상 종료합니다.
 * Electron `app.on('before-quit')` 에서 호출하세요.
 */
export function stopClipProxy(): void {
  if (proxyProcess && !proxyProcess.killed) {
    proxyProcess.kill('SIGTERM')
    proxyProcess = null
  }
}

export { BINARY_PATH, APP_BIN_DIR }
