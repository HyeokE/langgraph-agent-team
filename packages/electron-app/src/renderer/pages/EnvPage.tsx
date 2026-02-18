import { useEffect, useState } from 'react'
import { Lock, Plus, Trash2, X } from 'lucide-react'
import type { EnvVarEntry } from '../../main/types/envDefinition'

interface EnvFormState {
  key: string
  value: string
  description: string
}

function EnvModal({
  onSave,
  onClose
}: {
  onSave: (key: string, value: string, description?: string) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<EnvFormState>({ key: '', value: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!form.key.trim()) {
      setError('키 이름을 입력하세요')
      return
    }
    if (!form.value.trim()) {
      setError('값을 입력하세요')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(form.key.trim(), form.value.trim(), form.description.trim() || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const update = (field: keyof EnvFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">새 환경 변수</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <Lock size={10} className="inline mr-1" />
            값은 OS 키체인(safeStorage)으로 암호화되어 저장됩니다.
            저장 후에는 앱 외부에서 읽을 수 없습니다.
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              키 이름 <span className="text-zinc-400">(대문자, 숫자, 언더스코어)</span>
            </label>
            <input
              type="text"
              value={form.key}
              onChange={(e) => update('key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="BINANCE_API_KEY"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">값 (비밀)</label>
            <input
              type="password"
              value={form.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 placeholder:font-sans focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">설명 (선택)</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="예: Binance API 마스터 키"
              className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '암호화 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EnvPage() {
  const [envs, setEnvs] = useState<EnvVarEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const loadEnvs = async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.envs.list()
      setEnvs(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEnvs()
  }, [])

  const handleSave = async (key: string, value: string, description?: string) => {
    await window.electronAPI.envs.set(key, value, description)
    await loadEnvs()
  }

  const handleDelete = async (id: string, key: string) => {
    if (!confirm(`"${key}" 환경 변수를 삭제하시겠습니까?`)) return
    await window.electronAPI.envs.delete(id)
    setEnvs((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">환경 변수</h1>
          <p className="text-sm text-zinc-500">
            API 키 등 민감 정보를 OS 키체인으로 암호화하여 저장합니다
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus size={15} />
          새 환경 변수
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && <p className="text-sm text-zinc-500">불러오는 중…</p>}

        {!loading && envs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Lock size={32} className="text-zinc-300" />
            <p className="text-sm text-zinc-500">
              등록된 환경 변수가 없습니다.
              <br />
              API 키를 안전하게 저장하여 툴에서 사용하세요.
            </p>
          </div>
        )}

        {envs.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">키 이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">설명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">업데이트</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">값</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {envs.map((env) => (
                  <tr key={env.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-zinc-900">
                      {env.key}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {env.description ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {new Date(env.updatedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <Lock size={10} />
                        암호화됨
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void handleDelete(env.id, env.key)}
                        className="flex items-center justify-center rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <EnvModal
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
