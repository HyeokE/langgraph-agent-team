import { useState, useCallback } from 'react'
import type { ToolDefinition, ToolIndexEntry } from '../../main/types/toolDefinition'

export function useTools() {
  const [tools, setTools] = useState<ToolIndexEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTools = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.electronAPI.tools.list()
      setTools(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '툴 목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  const createTool = useCallback(
    async (def: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolDefinition> => {
      const tool = await window.electronAPI.tools.create(def)
      await loadTools()
      return tool
    },
    [loadTools]
  )

  const updateTool = useCallback(
    async (id: string, patch: Partial<ToolDefinition>): Promise<ToolDefinition> => {
      const tool = await window.electronAPI.tools.update(id, patch)
      await loadTools()
      return tool
    },
    [loadTools]
  )

  const deleteTool = useCallback(
    async (id: string): Promise<void> => {
      await window.electronAPI.tools.delete(id)
      setTools((prev) => prev.filter((t) => t.id !== id))
    },
    []
  )

  return { tools, loading, error, loadTools, createTool, updateTool, deleteTool }
}
