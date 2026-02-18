import { z } from 'zod'

export const EnvVarEntrySchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/, 'ENV 키는 대문자, 숫자, 언더스코어만 허용됩니다'),
  description: z.string().optional(),
  updatedAt: z.string().datetime()
})

export type EnvVarEntry = z.infer<typeof EnvVarEntrySchema>

export const EnvIndexSchema = z.object({
  envs: z.array(EnvVarEntrySchema)
})

export type EnvIndex = z.infer<typeof EnvIndexSchema>
