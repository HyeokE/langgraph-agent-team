import { z } from 'zod'
import type { StateFieldDefinition, StateFieldType } from '../types/teamDefinition.js'

// StateFieldType → Zod 타입 팩토리 맵 (불변)
const TYPE_MAP: Record<StateFieldType, () => z.ZodTypeAny> = {
  string: () => z.string(),
  number: () => z.number(),
  boolean: () => z.boolean(),
  'string[]': () => z.array(z.string()),
  'number[]': () => z.array(z.number()),
  object: () => z.record(z.string(), z.unknown())
}

function applyEnumConstraint(
  field: StateFieldDefinition,
  baseType: z.ZodTypeAny
): z.ZodTypeAny {
  const enumValues = field.enumValues
  if (!enumValues || enumValues.length === 0) return baseType

  const allowed = enumValues.map((value) => JSON.stringify(value)).join(', ')
  return baseType.refine(
    (value) => enumValues.some((candidate) => Object.is(candidate, value)),
    { message: `Field "${field.name}" must be one of: ${allowed}` }
  )
}

/**
 * StateFieldDefinition 배열을 Zod 스키마로 변환합니다.
 * 팀 실행 시 상태 검증에 사용됩니다.
 */
export function buildStateSchema(fields: StateFieldDefinition[]): z.ZodType {
  if (fields.length === 0) {
    throw new Error('At least one state field is required to build a schema.')
  }

  const shape: z.ZodRawShape = {}

  for (const field of fields) {
    const factory = TYPE_MAP[field.type]
    if (!factory) {
      throw new Error(`Unsupported state field type: "${field.type}" for field "${field.name}"`)
    }

    const baseType = factory()
    const constrainedType = applyEnumConstraint(field, baseType)
    shape[field.name] = field.optional ? constrainedType.optional() : constrainedType
  }

  return z.object(shape)
}

/**
 * 초기 상태 객체를 StateFieldDefinition의 default 값으로 채워 반환합니다.
 * default가 없는 필수 필드는 undefined로 남깁니다.
 */
export function buildInitialState(fields: StateFieldDefinition[]): Record<string, unknown> {
  const initial: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.default !== undefined) {
      initial[field.name] = field.default
    }
  }

  return initial
}
