import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import {
  ToolDefinitionSchema,
  ToolIndexSchema,
  type ToolDefinition,
  type ToolIndexEntry
} from '../types/toolDefinition.js'

const APP_DIR = join(homedir(), '.agent-team')
const TOOLS_DIR = join(APP_DIR, 'tools')
const INDEX_PATH = join(TOOLS_DIR, 'index.json')

const EMPTY_INDEX = { tools: [] as ToolIndexEntry[] }

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function readIndex(): Promise<{ tools: ToolIndexEntry[] }> {
  const raw = await readJsonFile(INDEX_PATH, EMPTY_INDEX)
  const parsed = ToolIndexSchema.safeParse(raw)
  return parsed.success ? parsed.data : EMPTY_INDEX
}

async function writeIndex(index: { tools: ToolIndexEntry[] }): Promise<void> {
  await ensureDir(TOOLS_DIR)
  await writeJsonFile(INDEX_PATH, index)
}

export class ToolRepository {
  static async initialize(): Promise<void> {
    await ensureDir(APP_DIR)
    await ensureDir(TOOLS_DIR)
  }

  static async list(): Promise<ToolIndexEntry[]> {
    const index = await readIndex()
    return [...index.tools].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  static async get(id: string): Promise<ToolDefinition | null> {
    const toolDir = join(TOOLS_DIR, id)
    const raw = await readJsonFile<unknown>(join(toolDir, 'definition.json'), null)
    if (raw === null) return null
    const parsed = ToolDefinitionSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  static async create(
    input: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ToolDefinition> {
    const now = new Date().toISOString()
    const tool: ToolDefinition = {
      ...input,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }

    const validated = ToolDefinitionSchema.parse(tool)
    const toolDir = join(TOOLS_DIR, validated.id)

    await ensureDir(toolDir)
    await writeJsonFile(join(toolDir, 'definition.json'), validated)

    const index = await readIndex()
    const entry: ToolIndexEntry = {
      id: validated.id,
      name: validated.name,
      type: validated.config.type,
      updatedAt: validated.updatedAt
    }
    await writeIndex({ tools: [...index.tools, entry] })

    return validated
  }

  static async update(
    id: string,
    patch: Partial<Omit<ToolDefinition, 'id' | 'createdAt'>>
  ): Promise<ToolDefinition> {
    const existing = await ToolRepository.get(id)
    if (!existing) throw new Error(`Tool not found: ${id}`)

    const updated: ToolDefinition = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    }

    const validated = ToolDefinitionSchema.parse(updated)
    await writeJsonFile(join(TOOLS_DIR, id, 'definition.json'), validated)

    const index = await readIndex()
    const updatedTools = index.tools.map((t) =>
      t.id === id
        ? { id: validated.id, name: validated.name, type: validated.config.type, updatedAt: validated.updatedAt }
        : t
    )
    await writeIndex({ tools: updatedTools })

    return validated
  }

  static async delete(id: string): Promise<void> {
    try {
      await fs.rm(join(TOOLS_DIR, id), { recursive: true, force: true })
    } catch {
      // 이미 없는 경우 무시
    }

    const index = await readIndex()
    await writeIndex({ tools: index.tools.filter((t) => t.id !== id) })
  }

  /**
   * 팀에 속한 툴 ID 목록을 ToolDefinition 맵으로 반환
   */
  static async getByIds(ids: string[]): Promise<Map<string, ToolDefinition>> {
    const map = new Map<string, ToolDefinition>()
    await Promise.all(
      ids.map(async (id) => {
        const tool = await ToolRepository.get(id)
        if (tool) map.set(id, tool)
      })
    )
    return map
  }
}
