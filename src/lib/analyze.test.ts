import { describe, expect, it } from 'vitest'
import type { Cell, ExamConfig, ExamData, ExamRole } from '../types'
import { buildExam, detectHeaderRow, guessConfig } from './parse'
import { analyze } from './analyze'
import { makeDemo } from './demo'

const SUBJECTS = ['语文', '数学']

function makeExam(role: ExamRole, label: string, students: [string, number, number][]): ExamData {
  const rows: Cell[][] = [['姓名', ...SUBJECTS, '总分']]
  for (const [name, chinese, math] of students) {
    rows.push([name, chinese, math, chinese + math])
  }
  const config: ExamConfig = {
    headerRow: 0,
    nameCol: 0,
    subjectCols: SUBJECTS.map((name, index) => ({ name, col: index + 1 })),
    totalCol: 3,
    rankCol: null,
  }
  return buildExam({ role, label, fileName: `${label}.xlsx`, sheetName: 'Sheet1', rows, config })
}

describe('parse', () => {
  it('能跳过标题行识别表头，并忽略统计行', () => {
    const rows: Cell[][] = [
      ['某某班月考成绩'],
      ['排名', '学生姓名', '语文', '数学', '总分'],
      [1, '张三', 100, 90, 190],
      [2, '李四', 95, 92, 187],
      [null, '最高分', 100, 92, 190],
      [null, '平均分', 97.5, 91, 188.5],
    ]
    const headerRow = detectHeaderRow(rows)
    expect(headerRow).toBe(1)
    const config = guessConfig(rows, headerRow)
    expect(config.nameCol).toBe(1)
    expect(config.subjectCols.map((item) => item.name)).toEqual(['语文', '数学'])
    expect(config.totalCol).toBe(4)
    const exam = buildExam({ role: 'base', label: '月考', fileName: 'x', sheetName: 's', rows, config })
    expect(exam.students).toHaveLength(2)
    expect(exam.students[0].total).toBe(190)
  })

  it('缺少总分列时按科目求和', () => {
    const rows: Cell[][] = [
      ['姓名', '语文', '数学'],
      ['张三', 80, 70],
    ]
    const config = guessConfig(rows, 0)
    const exam = buildExam({ role: 'base', label: '月考', fileName: 'x', sheetName: 's', rows, config })
    expect(exam.students[0].total).toBe(150)
  })

  it('重名学生会被编号区分', () => {
    const rows: Cell[][] = [
      ['姓名', '语文'],
      ['张三', 80],
      ['张三', 70],
    ]
    const config = guessConfig(rows, 0)
    const exam = buildExam({ role: 'base', label: '月考', fileName: 'x', sheetName: 's', rows, config })
    expect(exam.students.map((student) => student.id)).toEqual(['张三', '张三#2'])
    expect(exam.warnings.length).toBeGreaterThan(0)
  })
})

describe('analyze', () => {
  it('并列名次、名次升降与缺考处理正确', () => {
    const base = makeExam('base', '月考', [
      ['甲', 100, 50],
      ['乙', 100, 50],
      ['丙', 90, 55],
      ['丁', 80, 60],
      ['戊', 70, 65],
    ])
    const target = makeExam('target', '期中', [
      ['甲', 90, 55],
      ['乙', 100, 50],
      ['丙', 95, 60],
      ['丁', 80, 60],
    ])
    const result = analyze(base, target, {
      rankMode: 'competition',
      bucketSize: 50,
      fullMarks: {},
      passMarks: {},
    })

    expect(result.counts.baseCount).toBe(5)
    expect(result.counts.targetCount).toBe(4)
    expect(result.counts.comparable).toBe(4)
    expect(result.counts.baseOnly).toBe(1)

    const byName = Object.fromEntries(result.students.map((student) => [student.name, student]))
    // 基准：甲/乙 并列 1，丙 3，丁 4，戊 5
    expect(byName['甲'].baseTotalRank).toBe(1)
    expect(byName['乙'].baseTotalRank).toBe(1)
    expect(byName['丙'].baseTotalRank).toBe(3)
    // 对比：丙 155 第 1，乙 150 第 2，甲 145 第 3，丁 140 第 4
    expect(byName['丙'].targetTotalRank).toBe(1)
    expect(byName['乙'].targetTotalRank).toBe(2)
    expect(byName['甲'].targetTotalRank).toBe(3)
    expect(byName['甲'].totalRankDelta).toBe(-2)
    expect(byName['乙'].totalRankDelta).toBe(-1)
    expect(byName['丙'].totalRankDelta).toBe(2)
    expect(byName['丁'].totalRankDelta).toBe(0)
    expect(byName['戊'].totalRankDelta).toBeNull()
    expect(byName['戊'].note).toContain('仅基准')

    expect(result.counts.totalUp + result.counts.totalDown + result.counts.totalFlat).toBe(4)
  })

  it('顺序名次不跳号', () => {
    const base = makeExam('base', '月考', [
      ['甲', 100, 50],
      ['乙', 100, 50],
      ['丙', 90, 60],
    ])
    const target = makeExam('target', '期中', [
      ['甲', 100, 50],
      ['乙', 100, 50],
      ['丙', 90, 60],
    ])
    const result = analyze(base, target, {
      rankMode: 'sequential',
      bucketSize: 50,
      fullMarks: {},
      passMarks: {},
    })
    const ranks = result.students.map((student) => student.baseTotalRank)
    expect(ranks.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3])
  })

  it('演示数据规模与统计口径一致', () => {
    const demo = makeDemo()
    const result = analyze(demo.base, demo.target, demo.options)
    expect(result.students.length).toBe(47)
    expect(result.counts.comparable).toBe(46)
    expect(result.counts.baseOnly).toBe(1)
    expect(result.counts.totalUp + result.counts.totalDown + result.counts.totalFlat).toBe(46)
    expect(result.stats).toHaveLength(5)
    const bucketTotal = result.buckets.reduce((sum, bucket) => sum + bucket.target, 0)
    expect(bucketTotal).toBe(46)
    // 上升 / 下降 / 持平人数之和 = 可比人数 × 科目数
    const subjectTotal = result.stats.reduce((sum, stat) => sum + stat.up + stat.down + stat.flat, 0)
    expect(subjectTotal).toBe(46 * 5)
  })
})

