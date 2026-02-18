import { Link, useLocation } from 'react-router-dom'
import { Users, Plus, History, Wrench, Lock, Settings, Bot } from 'lucide-react'
import { cn } from '../../lib/cn'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { useAssistantState } from '../../contexts/AssistantStateContext'
import { LoginOverlay } from '../auth/LoginOverlay'
import { useAuth } from '../../hooks/useAuth'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '팀 목록', icon: <Users size={18} />, exact: true },
  { href: '/teams/new', label: '새 팀', icon: <Plus size={18} /> },
  { href: '/runs', label: '실행 기록', icon: <History size={18} /> },
  { href: '/tools', label: '툴 라이브러리', icon: <Wrench size={18} /> },
  { href: '/envs', label: '환경 변수', icon: <Lock size={18} /> }
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const { isOpen, context, pendingMessage, openWithContext, close, clearPendingMessage } =
    useAssistantState()
  const { status, loginLoading, loginError, login } = useAuth()

  const handleAssistantToggle = () => {
    if (isOpen) {
      close()
    } else {
      void openWithContext({})
    }
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      {/* 사이드바 */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        {/* 타이틀바 공간 (macOS hiddenInset 스타일) */}
        <div className="h-10 drag-region" />

        {/* 앱 이름 */}
        <div className="px-4 pb-3">
          <h1 className="text-sm font-bold text-zinc-800 tracking-tight">
            Agent Team Manager
          </h1>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 하단: AI 어시스턴트 토글 + 설정 */}
        <div className="border-t border-zinc-200 px-2 py-2 space-y-1">
          <button
            onClick={handleAssistantToggle}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isOpen
                ? 'bg-zinc-100 text-zinc-900 font-medium'
                : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
            )}
          >
            <Bot size={18} />
            AI 어시스턴트
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            onClick={() => {/* TODO: 설정 페이지 */}}
          >
            <Settings size={18} />
            설정
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 인증 안 된 경우 로그인 오버레이 표시 */}
        {status !== null && !status.authenticated ? (
          <LoginOverlay
            status={status}
            loginLoading={loginLoading}
            loginError={loginError}
            onLogin={login}
          />
        ) : (
          children
        )}
      </main>

      {/* AI 어시스턴트 패널 (우측 슬라이드) */}
      <AssistantPanel
        context={context}
        isOpen={isOpen}
        pendingMessage={pendingMessage}
        onPendingMessageHandled={clearPendingMessage}
        onClose={close}
      />
    </div>
  )
}
