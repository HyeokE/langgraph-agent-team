import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import { safeStorage } from 'electron'
import { EnvIndexSchema, EnvVarEntrySchema, type EnvVarEntry, type EnvIndex } from '../types/envDefinition.js'

const APP_DIR = join(homedir(), '.agent-team')
const ENVS_DIR = join(APP_DIR, 'envs')
const INDEX_PATH = join(ENVS_DIR, 'index.json')

const EMPTY_INDEX: EnvIndex = { envs: [] }

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

async function readIndex(): Promise<EnvIndex> {
  const raw = await readJsonFile(INDEX_PATH, EMPTY_INDEX)
  const parsed = EnvIndexSchema.safeParse(raw)
  return parsed.success ? parsed.data : EMPTY_INDEX
}

async function writeIndex(index: EnvIndex): Promise<void> {
  await ensureDir(ENVS_DIR)
  await writeJsonFile(INDEX_PATH, index)
}

function encPath(id: string): string {
  return join(ENVS_DIR, `${id}.enc`)
}

function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'safeStorage 암호화를 사용할 수 없습니다. OS 키체인이 잠겨 있을 수 있습니다.'
    )
  }
}

export class EnvStore {
  static async initialize(): Promise<void> {
    await ensureDir(APP_DIR)
    await ensureDir(ENVS_DIR)
  }

  /**
   * 모든 ENV 항목 목록 반환 (키 이름만, 값 없음)
   */
  static async list(): Promise<EnvVarEntry[]> {
    const index = await readIndex()
    return [...index.envs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /**
   * ENV 항목 생성 또는 업데이트 (값은 safeStorage로 암호화 저장)
   */
  static async set(
    key: string,
    value: string,
    description?: string
  ): Promise<EnvVarEntry> {
    assertEncryptionAvailable()

    const index = await readIndex()
    const existing = index.envs.find((e) => e.key === key)
    const now = new Date().toISOString()

    const entry: EnvVarEntry = EnvVarEntrySchema.parse({
      id: existing?.id ?? uuidv4(),
      key,
      description,
      updatedAt: now
    })

    // 암호화된 값을 바이너리 파일로 저장
    const encrypted = safeStorage.encryptString(value)
    await ensureDir(ENVS_DIR)
    await fs.writeFile(encPath(entry.id), encrypted)

    // 인덱스 업데이트 (값 없이 메타데이터만)
    const updatedEnvs = existing
      ? index.envs.map((e) => (e.id === existing.id ? entry : e))
      : [...index.envs, entry]

    await writeIndex({ envs: updatedEnvs })

    return entry
  }

  /**
   * ENV 항목 삭제 (암호화 파일 + 인덱스)
   */
  static async delete(id: string): Promise<void> {
    try {
      await fs.rm(encPath(id), { force: true })
    } catch {
      // 이미 없는 경우 무시
    }

    const index = await readIndex()
    await writeIndex({ envs: index.envs.filter((e) => e.id !== id) })
  }

  /**
   * ENV 키 이름으로 값을 복호화하여 반환
   * 없으면 process.env 폴백
   */
  static async resolve(key: string): Promise<string | undefined> {
    const index = await readIndex()
    const entry = index.envs.find((e) => e.key === key)

    if (entry) {
      try {
        assertEncryptionAvailable()
        const encrypted = await fs.readFile(encPath(entry.id))
        return safeStorage.decryptString(encrypted)
      } catch {
        // 복호화 실패 시 process.env 폴백으로 진행
      }
    }

    return process.env[key]
  }

  /**
   * 사용 가능한 모든 키 이름 목록 (자동완성 용)
   */
  static async listKeys(): Promise<string[]> {
    const index = await readIndex()
    return index.envs.map((e) => e.key).sort()
  }
}
