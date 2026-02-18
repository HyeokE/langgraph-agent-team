import type { BrowserWindow } from 'electron'
import type { SessionManager } from '../execution/SessionManager.js'

/**
 * SessionManager 이벤트를 BrowserWindow IPC로 브릿지합니다.
 * 창 생명주기와 실행 생명주기를 독립적으로 유지합니다.
 *
 * @returns IPC 브릿지 해제 함수
 */
export function bridgeSessionToWindow(
  sessionManager: SessionManager,
  sessionId: string,
  win: BrowserWindow
): () => void {
  // 창이 파괴되지 않은 경우에만 IPC 전송
  const safeSend = (channel: string, data: unknown): void => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  const removeListener = sessionManager.onEvent(sessionId, (event) => {
    safeSend(`team:${event.type}`, event.data)
  })

  // 창이 닫혀도 실행은 계속되고, IPC 브릿지만 해제
  win.once('closed', removeListener)

  return removeListener
}
