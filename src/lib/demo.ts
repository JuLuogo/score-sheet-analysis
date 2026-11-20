import type { AnalysisOptions, Cell, ExamData } from '../types'
import { buildExam, guessConfig } from './parse'

function makeRandom(seed: number) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const SUBJECTS = [
  { name: '语文', full: 120 },
  { name: '数学', full: 120 },
  { name: '英语', full: 120 },
  { name: '专业课', full: 200 },
  { name: '发动机', full: 100 },
]

function makeRows(
  scores: number[][],
  names: string[],
  totals: number[],
  ranks: number[],
): Cell[][] {
  const rows: Cell[][] = []
  rows.push(['示例班级 · 成绩对比演示数据'])
  rows.push(['排名', '学生姓名', ...SUBJECTS.map((s) => s.name), '总分'])
  scores.forEach((row, index) => {
    rows.push([ranks[index], names[index], ...row.map((v) => Math.round(v * 2) / 2), totals[index]])
  })
  rows.push([null, '最高分', ...SUBJECTS.map((_, i) => Math.max(...scores.map((row) => row[i]))), Math.max(...totals)])
  rows.push([null, '平均分', ...SUBJECTS.map((_, i) => Math.round((scores.reduce((s, row) => s + row[i], 0) / scores.length) * 10) / 10), Math.round((totals.reduce((s, v) => s + v, 0) / totals.length) * 10) / 10])
  return rows
}

function computeTotals(scores: number[][]): number[] {
  return scores.map((row) => Math.round(row.reduce((sum, v) => sum + v, 0) * 100) / 100)
}

function computeRanks(totals: number[]): number[] {
  const order = totals.map((total, index) => ({ total, index })).sort((a, b) => b.total - a.total)
  const ranks = new Array(totals.length).fill(0)
  let previous: number | null = null
  let rank = 0
  order.forEach((item, position) => {
    if (previous == null || item.total !== previous) {
      rank = position + 1
      previous = item.total
    }
    ranks[item.index] = rank
  })
  return ranks
}

function makeExam(role: 'base' | 'target', label: string, scores: number[][], names: string[]) {
  const totals = computeTotals(scores)
  const ranks = computeRanks(totals)
  const rows = makeRows(scores, names, totals, ranks)
  const config = guessConfig(rows, detectHeader(rows))
  return buildExam({
    role,
    label,
    fileName: role === 'base' ? '示例_第一次月考.xlsx' : '示例_期中考试.xlsx',
    sheetName: 'Sheet1',
    rows,
    config,
  })
}

function detectHeader(rows: Cell[][]): number {
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i]?.includes('学生姓名')) return i
  }
  return 0
}

/** 生成一份可玩的演示数据：47 人、5 科、其中 1 人期中缺考 */
export function makeDemo(): { base: ExamData; target: ExamData; options: AnalysisOptions } {
  const random = makeRandom(20261117)
  const count = 47
  const names = Array.from({ length: count }, (_, i) => `示例学生${String(i + 1).padStart(2, '0')}`)
  const ability = names.map(() => 0.35 + random() * 0.5)

  const baseScores = ability.map((level) => {
    const personal = level + (random() - 0.5) * 0.18
    return SUBJECTS.map((subject, subjectIndex) => {
      const bias = subjectIndex === 3 ? 0.12 : subjectIndex === 2 ? -0.12 : 0
      const value = subject.full * Math.min(0.98, Math.max(0.04, personal + bias + (random() - 0.5) * 0.22))
      return Math.round(value * 2) / 2
    })
  })

  const targetScores = baseScores.map((row, index) => {
    if (index === 22) return row
    const trend = (random() - 0.45) * 0.16
    return row.map((value, subjectIndex) => {
      const subject = SUBJECTS[subjectIndex]
      const change = subjectIndex === 3 ? 0.12 + trend : trend * 0.6
      const next = value * (1 + change) + (random() - 0.5) * 6
      return Math.round(Math.min(subject.full, Math.max(2, next)) * 2) / 2
    })
  })

  const base = makeExam('base', '第一次月考', baseScores, names)
  const targetNames = names.filter((_, index) => index !== 22)
  const target = makeExam('target', '期中考试', targetScores.filter((_, index) => index !== 22), targetNames)

  const options: AnalysisOptions = {
    rankMode: 'competition',
    bucketSize: 50,
    fullMarks: Object.fromEntries(SUBJECTS.map((s) => [s.name, s.full])),
    passMarks: { 语文: 72, 数学: 72, 英语: 72, 专业课: 120, 发动机: 60 },
  }
  return { base, target, options }
}

