import type { ConditionGrade } from '../types/database'

export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  A: 'Like new',
  B: 'Gently used',
  C: 'Well loved',
}

export const CONDITION_EXPLANATIONS: Record<ConditionGrade, string> = {
  A: 'Looks and feels close to new — no visible wear.',
  B: 'Clearly used but in good shape — light wear, no damage.',
  C: 'Shows noticeable wear (fading, small marks, etc.) but fully wearable.',
}
