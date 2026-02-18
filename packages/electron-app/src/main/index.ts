import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { TeamRepository } from './storage/TeamRepository.js'
import { ToolRepository } from './storage/ToolRepository.js'
import { EnvStore } from './storage/EnvStore.js'
import { buildCryptoTradingTeamSeed } from './storage/teamSeed.js'
import { SessionManager } from './execution/SessionManager.js'
import { registerIpcHandlers, setAccessToken } from './ipc/handlers.js'
import { ensureClipProxy, stopClipProxy, type SetupStatus } from './setup/cliproxyManager.js'
import { getOrCreateApiKey, ensureClipProxyConfig, ensureCodexConfig } from './setup/configSetup.js'

function sendSetupStatus(win: BrowserWindow, status: SetupStatus): void {
  if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('setup:status', status)
  }
}

async function runAutoSetup(win: BrowserWindow): Promise<void> {
  try {
    const apiKey = await getOrCreateApiKey()
    const configPath = await ensureClipProxyConfig(apiKey)
    await ensureCodexConfig()
    await ensureClipProxy(configPath, apiKey, (status) => sendSetupStatus(win, status))
    setAccessToken(apiKey)
  } catch (err) {
    sendSetupStatus(win, {
      stage: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

function createWindow(sessionManager: SessionManager): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Agent Team Manager',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      // 보안 설정: 렌더러에서 Node.js API 접근 완전 차단
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  // 외부 링크는 기본 브라우저로 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // IPC 핸들러 등록 (창 인스턴스와 세션 매니저 연결)
  registerIpcHandlers(win, sessionManager)

  // 렌더러 로드 완료 후 CLIProxyAPI 자동 셋업 시작
  win.webContents.once('did-finish-load', () => {
    void runAutoSetup(win)
  })

  // 개발(dev server): ELECTRON_RENDERER_URL이 주입됨
  // 프로덕션(빌드된 앱): 로컬 파일 로드
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

async function main(): Promise<void> {
  // 저장소 초기화 (디렉토리 생성)
  await TeamRepository.initialize()
  await ToolRepository.initialize()
  await EnvStore.initialize()

  const teams = await TeamRepository.list()
  if (teams.length === 0) {
    await TeamRepository.create(buildCryptoTradingTeamSeed())
  }

  const sessionManager = new SessionManager()

  await app.whenReady()

  createWindow(sessionManager)

  // 앱 종료 전 CLIProxyAPI 프로세스 정리
  app.on('before-quit', () => {
    stopClipProxy()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(sessionManager)
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

main().catch((err) => {
  console.error('Failed to start app:', err)
  process.exit(1)
})
