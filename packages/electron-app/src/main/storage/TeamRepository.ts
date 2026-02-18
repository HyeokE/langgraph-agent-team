import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import {
  TeamDefinitionSchema,
  TeamIndexSchema,
  type TeamDefinition,
  type TeamIndexEntry,
  type RunResult
} from '../types/teamDefinition.js'

const APP_DIR = join(homedir(), '.agent-team')
const TEAMS_DIR = join(APP_DIR, 'teams')
const INDEX_PATH = join(TEAMS_DIR, 'index.json')

// 팀 인덱스 초기값 (불변)
const EMPTY_INDEX = { teams: [] as TeamIndexEntry[] }

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
  const content = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, content, 'utf-8')
}

async function readIndex(): Promise<{ teams: TeamIndexEntry[] }> {
  const raw = await readJsonFile(INDEX_PATH, EMPTY_INDEX)
  const parsed = TeamIndexSchema.safeParse(raw)
  return parsed.success ? parsed.data : EMPTY_INDEX
}

async function writeIndex(index: { teams: TeamIndexEntry[] }): Promise<void> {
  await ensureDir(TEAMS_DIR)
  await writeJsonFile(INDEX_PATH, index)
}

export class TeamRepository {
  /**
   * 팀 디렉토리 및 인덱스 파일 초기화
   */
  static async initialize(): Promise<void> {
    await ensureDir(APP_DIR)
    await ensureDir(TEAMS_DIR)
  }

  /**
   * 팀 목록 반환 (경량 인덱스 기반)
   */
  static async list(): Promise<TeamIndexEntry[]> {
    const index = await readIndex()
    return [...index.teams].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /**
   * 팀 상세 정보 반환
   */
  static async get(id: string): Promise<TeamDefinition | null> {
    const teamDir = join(TEAMS_DIR, id)
    const defPath = join(teamDir, 'definition.json')
    const raw = await readJsonFile<unknown>(defPath, null)

    if (raw === null) return null

    const parsed = TeamDefinitionSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  /**
   * 새 팀 생성 및 저장
   */
  static async create(
    input: Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<TeamDefinition> {
    const now = new Date().toISOString()
    const team: TeamDefinition = {
      ...input,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }

    const validated = TeamDefinitionSchema.parse(team)
    const teamDir = join(TEAMS_DIR, validated.id)

    await ensureDir(teamDir)
    await ensureDir(join(teamDir, 'runs'))
    await writeJsonFile(join(teamDir, 'definition.json'), validated)

    // 인덱스 업데이트 (새 항목 추가)
    const index = await readIndex()
    const entry: TeamIndexEntry = {
      id: validated.id,
      name: validated.name,
      category: validated.category,
      updatedAt: validated.updatedAt
    }
    await writeIndex({ teams: [...index.teams, entry] })

    return validated
  }

  /**
   * 팀 정보 업데이트
   */
  static async update(
    id: string,
    patch: Partial<Omit<TeamDefinition, 'id' | 'createdAt'>>
  ): Promise<TeamDefinition> {
    const existing = await TeamRepository.get(id)
    if (!existing) {
      throw new Error(`Team not found: ${id}`)
    }

    const updated: TeamDefinition = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    }

    const validated = TeamDefinitionSchema.parse(updated)
    const teamDir = join(TEAMS_DIR, id)
    await writeJsonFile(join(teamDir, 'definition.json'), validated)

    // 인덱스 업데이트 (기존 항목 교체)
    const index = await readIndex()
    const updatedTeams = index.teams.map((t) =>
      t.id === id
        ? { id: validated.id, name: validated.name, category: validated.category, updatedAt: validated.updatedAt }
        : t
    )
    await writeIndex({ teams: updatedTeams })

    return validated
  }

  /**
   * 팀 삭제 (디렉토리 전체 제거)
   */
  static async delete(id: string): Promise<void> {
    const teamDir = join(TEAMS_DIR, id)

    try {
      await fs.rm(teamDir, { recursive: true, force: true })
    } catch {
      // 이미 없는 경우 무시
    }

    // 인덱스에서 제거
    const index = await readIndex()
    const filteredTeams = index.teams.filter((t) => t.id !== id)
    await writeIndex({ teams: filteredTeams })
  }

  /**
   * 실행 결과 저장
   */
  static async saveRun(teamId: string, result: RunResult): Promise<void> {
    const runsDir = join(TEAMS_DIR, teamId, 'runs')
    await ensureDir(runsDir)
    await writeJsonFile(join(runsDir, `${result.runId}.json`), result)
  }

  /**
   * 팀의 실행 기록 목록 반환
   */
  static async listRuns(teamId: string): Promise<RunResult[]> {
    const runsDir = join(TEAMS_DIR, teamId, 'runs')

    try {
      const files = await fs.readdir(runsDir)
      const jsonFiles = files.filter((f) => f.endsWith('.json'))

      const results: RunResult[] = []
      for (const file of jsonFiles) {
        const raw = await readJsonFile<unknown>(join(runsDir, file), null)
        if (raw !== null) {
          results.push(raw as RunResult)
        }
      }

      return results.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    } catch {
      return []
    }
  }
}
