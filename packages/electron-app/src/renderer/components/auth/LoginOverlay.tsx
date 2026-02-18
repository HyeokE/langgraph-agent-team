import { Loader2, LogIn, AlertCircle, CheckCircle } from 'lucide-react'
import type { AuthStatus } from '../../hooks/useAuth'

interface LoginOverlayProps {
  status: AuthStatus
  loginLoading: boolean
  loginError: string | null
  onLogin: () => void
}

export function LoginOverlay({ status, loginLoading, loginError, onLogin }: LoginOverlayProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50">
      <div className="w-80 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        {/* 아이콘 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                fill="#10a37f"
              />
              <path
                d="M8 12l3 3 5-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <h2 className="mb-1 text-center text-lg font-semibold text-zinc-900">
          Agent Team Manager
        </h2>
        <p className="mb-6 text-center text-sm text-zinc-500">
          OpenAI 계정으로 로그인하세요
        </p>

        {/* 상태 정보 */}
        <div className="mb-6 space-y-2">
          <StatusRow
            label="CLIProxyAPI"
            ok={status.proxyRunning}
            okText="실행 중"
            failText="실행 안됨"
          />
          <StatusRow
            label="OpenAI 인증"
            ok={status.hasValidToken}
            okText={status.tokenEmail ?? '유효'}
            failText="로그인 필요"
          />
          <StatusRow
            label="API 연결"
            ok={status.authenticated}
            okText="연결됨"
            failText="키 미인식"
          />
        </div>

        {/* 에러 메시지 */}
        {loginError && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={14} className="mt-0.5 flex-none" />
            <span>{loginError}</span>
          </div>
        )}

        {/* 로그인 버튼 */}
        <button
          onClick={onLogin}
          disabled={loginLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {loginLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              브라우저에서 로그인 중…
            </>
          ) : (
            <>
              <LogIn size={16} />
              Google 계정으로 로그인
            </>
          )}
        </button>

        <p className="mt-3 text-center text-xs text-zinc-400">
          ChatGPT Pro 계정이 필요합니다
        </p>
      </div>
    </div>
  )
}

function StatusRow({
  label,
  ok,
  okText,
  failText
}: {
  label: string
  ok: boolean
  okText: string
  failText: string
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`flex items-center gap-1 font-medium ${ok ? 'text-green-600' : 'text-zinc-400'}`}>
        {ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
        {ok ? okText : failText}
      </span>
    </div>
  )
}
