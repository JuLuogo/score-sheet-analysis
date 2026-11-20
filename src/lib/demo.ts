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

function computeTotals(scores: number[][]): number[] {
  return scores.map((row) => Math.round(row.reduce((sum, value) => sum + value, 0) * 100) / 100)
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

function makeRows(scores: number[][], names: string[], totals: number[], ranks: number[]): Cell[][] {
  const rows: Cell[][] = []
  rows.push(['示例班级 · 成绩对比演示数据'])
  rows.push(['排名', '学生姓名', ...SUBJECTS.map((subject) => subject.name), '总分'])
  scores.forEach((row, index) => {
    rows.push([ranks[index], names[index], ...row.map((value) => Math.round(value * 2) / 2), totals[index]])
  })
  rows.push([
    null,
    '最高分',
    ...SUBJECTS.map((_, index) => Math.max(...scores.map((row) => row[index]))),
    Math.max(...totals),
  ])
  rows.push([
    null,
    '平均分',
    ...SUBJECTS.map(
      (_, index) =>
        Math.round((scores.reduce((sum, row) => sum + row[index], 0) / scores.length) * 10) / 10,
    ),
    Math.round((totals.reduce((sum, value) => sum + value, 0) / totals.length) * 10) / 10,
  ])
  return rows
}

function makeExam(id: string, label: string, fileName: string, scores: number[][], names: string[]): ExamData {
  const totals = computeTotals(scores)
  const ranks = computeRanks(totals)
  const rows = makeRows(scores, names, totals, ranks)
  const headerRow = rows.findIndex((row) => row.includes('学生姓名'))
  const config = guessConfig(rows, headerRow < 0 ? 0 : headerRow)
  return buildExam({ id, label, fileName, sheetName: 'Sheet1', rows, config })
}

/** 三场考试演示数据：第一次月考 → 第二次月考 → 期中考试（47 人，期中 1 人缺考） */
export function makeDemo(): { exams: ExamData[]; options: AnalysisOptions } {
  const random = makeRandom(20261120)
  const count = 47
  const names = Array.from({ length: count }, (_, index) => `示例学生${String(index + 1).padStart(2, '0')}`)
  const ability = names.map(() => 0.34 + random() * 0.5)

  const exam1 = ability.map((level) => {
    const personal = level + (random() - 0.5) * 0.18
    return SUBJECTS.map((subject, subjectIndex) => {
      const bias = subjectIndex === 3 ? 0.1 : subjectIndex === 2 ? -0.12 : 0
      const value = subject.full * Math.min(0.98, Math.max(0.04, personal + bias + (random() - 0.5) * 0.2))
      return Math.round(value * 2) / 2
    })
  })

  const exam2 = exam1.map((row) =>
    row.map((value, subjectIndex) => {
      const subject = SUBJECTS[subjectIndex]
      const next = value * (1 + (random() - 0.42) * 0.1) + (random() - 0.5) * 8
      return Math.round(Math.min(subject.full, Math.max(2, next)) * 2) / 2
    }),
  )

  const exam3 = exam2.map((row, index) => {
    if (index === 22) return row
    return row.map((value, subjectIndex) => {
      const subject = SUBJECTS[subjectIndex]
      const boost = subjectIndex === 3 ? 0.14 : subjectIndex === 0 ? -0.04 : 0.02
      const next = value * (1 + boost + (random() - 0.45) * 0.12) + (random() - 0.5) * 8
      return Math.round(Math.min(subject.full, Math.max(2, next)) * 2) / 2
    })
  })

  const exams = [
    makeExam('exam-1', '第一次月考', '示例_第一次月考.xlsx', exam1, names),
    makeExam('exam-2', '第二次月考', '示例_第二次月考.xlsx', exam2, names),
    makeExam(
      'exam-3',
      '期中考试',
      '示例_期中考试.xlsx',
      exam3.filter((_, index) => index !== 22),
      names.filter((_, index) => index !== 22),
    ),
  ]

  const options: AnalysisOptions = {
    rankMode: 'competition',
    bucketSize: 50,
    fullMarks: Object.fromEntries(SUBJECTS.map((subject) => [subject.name, subject.full])),
    passMarks: { 语文: 72, 数学: 72, 英语: 72, 专业课: 120, 发动机: 60 },
  }
  return { exams, options }
}
