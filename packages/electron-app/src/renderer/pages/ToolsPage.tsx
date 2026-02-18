import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Globe, Code2, Trash2, Pencil } from 'lucide-react'
import { useTools } from '../hooks/useTools'
import type { ToolIndexEntry } from '../../main/types/toolDefinition'

function ToolTypeIcon({ type }: { type: ToolIndexEntry['type'] }) {
  return type === 'http' ? (
    <Globe size={14} className="text-blue-500" />
  ) : (
    <Code2 size={14} className="text-amber-500" />
  )
}

export function ToolsPage() {
  const navigate = useNavigate()
  const { tools, loading, error, loadTools, deleteTool } = useTools()
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    void loadTools()
  }, [loadTools])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 툴을 삭제하시겠습니까?`)) return
    setDeleting(id)
    try {
      await deleteTool(id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">툴 라이브러리</h1>
          <p className="text-sm text-zinc-500">에이전트에 연결할 HTTP/Script 툴을 관리합니다</p>
        </div>
        <button
          onClick={() => navigate('/tools/new')}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus size={15} />
          새 툴
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <p className="text-sm text-zinc-500">불러오는 중…</p>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {!loading && tools.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <div className="text-3xl">🔧</div>
            <p className="text-sm text-zinc-500">
              아직 툴이 없습니다.
              <br />
              새 툴을 만들어 에이전트에 연결하세요.
            </p>
            <button
              onClick={() => navigate('/tools/new')}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Plus size={14} />
              첫 번째 툴 만들기
            </button>
          </div>
        )}

        {tools.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ToolTypeIcon type={tool.type} />
                    <span className="font-medium text-sm text-zinc-900 truncate">{tool.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate(`/tools/${tool.id}/edit`)}
                      className="flex items-center justify-center rounded p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => void handleDelete(tool.id, tool.name)}
                      disabled={deleting === tool.id}
                      className="flex items-center justify-center rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 uppercase font-medium">
                    {tool.type}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(tool.updatedAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
