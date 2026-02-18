import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TeamsPage } from './pages/TeamsPage'
import { TeamBuilderPage } from './pages/TeamBuilderPage'
import { TeamRunPage } from './pages/TeamRunPage'
import { RunHistoryPage } from './pages/RunHistoryPage'
import { ToolsPage } from './pages/ToolsPage'
import { ToolBuilderPage } from './pages/ToolBuilderPage'
import { EnvPage } from './pages/EnvPage'
import { AssistantStateProvider } from './contexts/AssistantStateContext'

export function App() {
  return (
    <AssistantStateProvider>
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<TeamsPage />} />
          <Route path="/teams/new" element={<TeamBuilderPage />} />
          <Route path="/teams/:id/edit" element={<TeamBuilderPage />} />
          <Route path="/teams/:id/run" element={<TeamRunPage />} />
          <Route path="/runs" element={<RunHistoryPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/tools/new" element={<ToolBuilderPage />} />
          <Route path="/tools/:id/edit" element={<ToolBuilderPage />} />
          <Route path="/envs" element={<EnvPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
    </AssistantStateProvider>
  )
}
