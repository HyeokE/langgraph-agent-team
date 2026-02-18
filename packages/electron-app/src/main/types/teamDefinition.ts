import { z } from 'zod'

// StateFieldDefinition: 상태 필드 타입 정보 (Zod 스키마 자동 생성에 필요)
export const StateFieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'string[]',
  'number[]',
  'object'
])

export type StateFieldType = z.infer<typeof StateFieldTypeSchema>

const SCALAR_STATE_FIELD_TYPES = ['string', 'number', 'boolean'] as const

const ScalarStateFieldTypeSchema = z.enum(SCALAR_STATE_FIELD_TYPES)

type ScalarStateFieldType = z.infer<typeof ScalarStateFieldTypeSchema>

export const StateFieldEnumValueSchema = z.union([z.string(), z.number(), z.boolean()])

export type StateFieldEnumValue = z.infer<typeof StateFieldEnumValueSchema>

function isScalarStateFieldType(type: StateFieldType): type is ScalarStateFieldType {
  return SCALAR_STATE_FIELD_TYPES.includes(type as ScalarStateFieldType)
}

function isEnumValueCompatible(
  type: ScalarStateFieldType,
  value: StateFieldEnumValue
): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    default:
      return false
  }
}

function hasDuplicateEnumValues(values: StateFieldEnumValue[]): boolean {
  const seen = new Set<string>()
  for (const value of values) {
    const key = `${typeof value}:${String(value)}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export const StateFieldDefinitionSchema = z.object({
  name: z.string().min(1),
  type: StateFieldTypeSchema,
  optional: z.boolean().optional(),
  default: z.unknown().optional(),
  description: z.string().optional(),
  enumValues: z.array(StateFieldEnumValueSchema).min(1).optional()
}).superRefine((field, ctx) => {
  if (!field.enumValues || field.enumValues.length === 0) return

  if (!isScalarStateFieldType(field.type)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enumValues'],
      message: 'enumValues is only supported for string, number, and boolean fields.'
    })
    return
  }

  const scalarType = field.type

  if (field.enumValues.some((value) => !isEnumValueCompatible(scalarType, value))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enumValues'],
      message: `enumValues must match field type "${scalarType}".`
    })
  }

  if (hasDuplicateEnumValues(field.enumValues)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enumValues'],
      message: 'enumValues contains duplicate values.'
    })
  }

  if (
    field.default !== undefined &&
    !field.enumValues.some((value) => Object.is(value, field.default))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['default'],
      message: 'default must be one of enumValues.'
    })
  }
})

export type StateFieldDefinition = z.infer<typeof StateFieldDefinitionSchema>

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  systemPrompt: z.string().min(1),
  outputField: z.string().min(1),
  toolIds: z.array(z.string().uuid()).optional()
})

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>

export const SupervisorDefinitionSchema = z.object({
  id: z.string().min(1),
  systemPrompt: z.string().min(1)
})

export type SupervisorDefinition = z.infer<typeof SupervisorDefinitionSchema>

export const TeamDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().min(1),
  supervisor: SupervisorDefinitionSchema,
  agents: z.array(AgentDefinitionSchema).min(1),
  stateFields: z.array(StateFieldDefinitionSchema).min(1),
  maxSteps: z.number().int().positive().max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type TeamDefinition = z.infer<typeof TeamDefinitionSchema>

// 팀 인덱스 항목 (목록 화면에서 경량 데이터로 표시)
export const TeamIndexEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  updatedAt: z.string().datetime()
})

export type TeamIndexEntry = z.infer<typeof TeamIndexEntrySchema>

export const TeamIndexSchema = z.object({
  teams: z.array(TeamIndexEntrySchema)
})

export type TeamIndex = z.infer<typeof TeamIndexSchema>

// 실행 결과 저장용
export const RunResultSchema = z.object({
  runId: z.string().uuid(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  steps: z.number().int().nonnegative(),
  reason: z.string(),
  state: z.record(z.string(), z.unknown()),
  routeTrace: z.array(
    z.object({
      step: z.number().int(),
      from: z.string(),
      to: z.string(),
      timestamp: z.string()
    })
  )
})

export type RunResult = z.infer<typeof RunResultSchema>
