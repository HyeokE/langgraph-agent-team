import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ToolBuilderForm } from '../components/tool-builder/ToolBuilderForm'
import type { ToolDefinition } from '../../main/types/toolDefinition'

export function ToolBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [existing, setExisting] = useState<ToolDefinition | null>(null)
  const [availableEnvKeys, setAvailableEnvKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    void window.electronAPI.envs.listKeys().then(setAvailableEnvKeys)
  }, [])

  useEffect(() => {
    if (id) {
      setLoading(true)
      window.electronAPI.tools.get(id)
        .then(setExisting)
        .catch(() => setExisting(null))
        .finally(() => setLoading(false))
    }
  }, [id])

  const handleSubmit = async (
    data: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (isEdit && id) {
      await window.electronAPI.tools.update(id, data)
    } else {
      await window.electronAPI.tools.create(data)
    }
    navigate('/tools')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
        <button
          onClick={() => navigate('/tools')}
          className="flex items-center justify-center rounded p-1.5 text-zinc-500 hover:bg-zinc-100"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            {isEdit ? '툴 편집' : '새 툴 만들기'}
          </h1>
          <p className="text-sm text-zinc-500">
            에이전트 실행 시 자동으로 호출되는 툴입니다
          </p>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <ToolBuilderForm
            initial={existing ?? undefined}
            availableEnvKeys={availableEnvKeys}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/tools')}
          />
        </div>
      </div>
    </div>
  )
}
