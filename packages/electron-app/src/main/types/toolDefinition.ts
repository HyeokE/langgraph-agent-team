import { z } from 'zod'

// HTTP 메서드 허용 목록
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export const HttpToolConfigSchema = z.object({
  type: z.literal('http'),
  method: z.enum(HTTP_METHODS),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional()
})

export type HttpToolConfig = z.infer<typeof HttpToolConfigSchema>

export const ScriptToolConfigSchema = z.object({
  type: z.literal('script'),
  code: z.string().min(1)
})

export type ScriptToolConfig = z.infer<typeof ScriptToolConfigSchema>

export const ToolConfigSchema = z.discriminatedUnion('type', [
  HttpToolConfigSchema,
  ScriptToolConfigSchema
])

export type ToolConfig = z.infer<typeof ToolConfigSchema>

export const ToolDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  config: ToolConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

// 목록 화면용 경량 항목
export const ToolIndexEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['http', 'script']),
  updatedAt: z.string().datetime()
})

export type ToolIndexEntry = z.infer<typeof ToolIndexEntrySchema>

export const ToolIndexSchema = z.object({
  tools: z.array(ToolIndexEntrySchema)
})

export type ToolIndex = z.infer<typeof ToolIndexSchema>
