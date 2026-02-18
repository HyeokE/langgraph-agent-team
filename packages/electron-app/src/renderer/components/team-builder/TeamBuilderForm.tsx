import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import type { TeamDefinition, AgentDefinition, StateFieldDefinition, SupervisorDefinition } from '../../../main/types/teamDefinition'
import type { ToolIndexEntry } from '../../../main/types/toolDefinition'
import { SupervisorForm } from './SupervisorForm'
import { AgentList } from './AgentList'
import { StateFieldEditor } from './StateFieldEditor'

interface TeamFormData {
  name: string
  description: string
  category: string
  maxSteps: number
  supervisor: SupervisorDefinition
  agents: AgentDefinition[]
  stateFields: StateFieldDefinition[]
}

function buildInitialFormData(team?: TeamDefinition): TeamFormData {
  if (team) {
    return {
      name: team.name,
      description: team.description ?? '',
      category: team.category,
      maxSteps: team.maxSteps,
      supervisor: { ...team.supervisor },
      agents: team.agents.map((a) => ({ ...a })),
      stateFields: team.stateFields.map((f) => ({ ...f }))
    }
  }

  return {
    name: '',
    description: '',
    category: '일반',
    maxSteps: 20,
    supervisor: { id: 'supervisor', systemPrompt: '' },
    agents: [],
    stateFields: []
  }
}

interface TeamBuilderFormProps {
  existingTeam?: TeamDefinition
}

export function TeamBuilderForm({ existingTeam }: TeamBuilderFormProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<TeamFormData>(() =>
    buildInitialFormData(existingTeam)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableTools, setAvailableTools] = useState<ToolIndexEntry[]>([])

  useEffect(() => {
    void window.electronAPI.tools.list().then(setAvailableTools).catch(() => setAvailableTools([]))
  }, [])

  const updateFormData = (patch: Partial<TeamFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      if (existingTeam) {
        await window.electronAPI.teams.update(existingTeam.id, formData)
      } else {
        await window.electronAPI.teams.create(formData)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-zinc-900">
            {existingTeam ? '팀 편집' : '새 팀 만들기'}
          </h2>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mx-6 mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 폼 본문 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* 기본 정보 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800 uppercase tracking-wide">
            기본 정보
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                팀 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="예: 암호화폐 트레이딩 팀"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                style={{ userSelect: 'text' }}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">카테고리</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => updateFormData({ category: e.target.value })}
                placeholder="예: 금융, 분석, 자동화"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                style={{ userSelect: 'text' }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              placeholder="팀의 목적과 기능을 설명하세요..."
              rows={2}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
              style={{ userSelect: 'text' }}
            />
          </div>

          <div className="w-32">
            <label className="mb-1 block text-sm font-medium text-zinc-700">최대 스텝</label>
            <input
              type="number"
              min={1}
              max={100}
              value={formData.maxSteps}
              onChange={(e) => updateFormData({ maxSteps: parseInt(e.target.value, 10) || 20 })}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
              style={{ userSelect: 'text' }}
            />
          </div>
        </section>

        {/* Supervisor 설정 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 uppercase tracking-wide">
            Supervisor 설정
          </h3>
          <SupervisorForm
            supervisor={formData.supervisor}
            onChange={(supervisor) => updateFormData({ supervisor })}
          />
        </section>

        {/* 에이전트 목록 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 uppercase tracking-wide">
            에이전트 구성
          </h3>
          <AgentList
            agents={formData.agents}
            availableTools={availableTools}
            onChange={(agents) => updateFormData({ agents })}
          />
        </section>

        {/* 상태 필드 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 uppercase tracking-wide">
            입력/출력 상태 스키마
          </h3>
          <p className="text-xs text-zinc-500">
            실행 화면에서 입력받을 값과 에이전트가 결과를 저장할 값을 여기서 정의합니다.
          </p>
          <StateFieldEditor
            fields={formData.stateFields}
            suggestedOutputFields={formData.agents.map((agent) => agent.outputField)}
            onChange={(stateFields) => updateFormData({ stateFields })}
          />
        </section>
      </div>
    </form>
  )
}
