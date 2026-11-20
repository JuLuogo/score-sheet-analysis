export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function fmtScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function fmtDelta(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  const text = digits > 0 ? (Number.isInteger(abs) ? String(abs) : abs.toFixed(digits)) : String(abs)
  return `${value > 0 ? '+' : '-'}${text}`
}

export function fmtRank(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return String(value)
}

export function fmtRankDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value === 0) return '0'
  return `${value > 0 ? '↑ ' : '↓ '}${Math.abs(value)}`
}

export type DeltaTone = 'up' | 'down' | 'flat' | 'na'

export function deltaTone(value: number | null | undefined): DeltaTone {
  if (value == null || Number.isNaN(value)) return 'na'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

export function deltaWord(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '未参考'
  if (value > 0) return `↑ 上升 ${value} 名`
  if (value < 0) return `↓ 下降 ${Math.abs(value)} 名`
  return '— 持平'
}

export function average(values: (number | null | undefined)[]): number | null {
  const list = values.filter((v): v is number => v != null && !Number.isNaN(v))
  if (!list.length) return null
  return list.reduce((sum, v) => sum + v, 0) / list.length
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
