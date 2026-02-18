import type { ToolDefinition } from './toolDefinition.js'
import type { TeamDefinition } from './teamDefinition.js'
import type { ToolIndexEntry } from './toolDefinition.js'

export type AssistantAction =
  | { type: 'createTool'; spec: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'updateTool'; id: string; patch: Partial<Pick<ToolDefinition, 'name' | 'description' | 'config'>> }
  | { type: 'createTeam'; spec: Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'updateTeam'; id: string; patch: Partial<Pick<TeamDefinition, 'name' | 'description' | 'agents' | 'supervisor' | 'stateFields' | 'maxSteps'>> }

export interface AssistantContext {
  currentTeam?: TeamDefinition
  toolLibrary: ToolIndexEntry[]
  availableEnvKeys: string[]
  lastRunError?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: AssistantAction
}

export interface AssistantResponse {
  message: string
  action?: AssistantAction
}
