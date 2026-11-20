import { describe, expect, it } from 'vitest'
import type { Cell, ExamConfig, ExamData } from '../types'
import { buildExam, detectHeaderRow, guessConfig } from './parse'
import { analyzeSeries } from './analyze'
import { makeDemo } from './demo'

const SUBJECTS = ['语文', '数学']

function makeExam(id: string, label: string, students: [string, number, number][]): ExamData {
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
  return buildExam({ id, label, fileName: `${label}.xlsx`, sheetName: 'Sheet1', rows, config })
}

const OPTIONS = {
  rankMode: 'competition' as const,
  bucketSize: 50,
  fullMarks: {},
  passMarks: {},
}

describe('parse', () => {
  it('跳过标题行识别表头，并忽略统计行', () => {
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
    const exam = buildExam({
      id: 'e1',
      label: '月考',
      fileName: 'x',
      sheetName: 's',
      rows,
      config,
    })
    expect(exam.students).toHaveLength(2)
    expect(exam.students[0].total).toBe(190)
  })

  it('缺少总分列时按科目求和', () => {
    const rows: Cell[][] = [
      ['姓名', '语文', '数学'],
      ['张三', 80, 70],
    ]
    const config = guessConfig(rows, 0)
    const exam = buildExam({ id: 'e1', label: '月考', fileName: 'x', sheetName: 's', rows, config })
    expect(exam.students[0].total).toBe(150)
  })
})

describe('analyzeSeries', () => {
  it('两场对比：并列名次、缺考处理正确', () => {
    const exam1 = makeExam('e1', '第一次月考', [
      ['甲', 100, 50],
      ['乙', 100, 50],
      ['丙', 90, 55],
      ['丁', 80, 60],
      ['戊', 70, 65],
    ])
    const exam2 = makeExam('e2', '期中', [
      ['甲', 90, 55],
      ['乙', 100, 50],
      ['丙', 95, 60],
      ['丁', 80, 60],
    ])
    const result = analyzeSeries([exam1, exam2], OPTIONS)
    expect(result.counts.examCounts).toEqual([5, 4])
    expect(result.counts.comparableAll).toBe(4)
    expect(result.counts.firstOnly).toBe(1)

    const byName = Object.fromEntries(result.students.map((student) => [student.name, student]))
    expect(byName['甲'].totalRanks[0]).toBe(1)
    expect(byName['乙'].totalRanks[0]).toBe(1)
    expect(byName['丙'].totalRanks[0]).toBe(3)
    expect(byName['丙'].totalRanks[1]).toBe(1)
    expect(byName['乙'].totalRanks[1]).toBe(2)
    expect(byName['甲'].totalRanks[1]).toBe(3)
    expect(byName['甲'].totalRankDelta).toBe(-2)
    expect(byName['丙'].totalRankDelta).toBe(2)
    expect(byName['戊'].totalRankDelta).toBeNull()
    expect(byName['戊'].note).toContain('未参考')
  })

  it('三场对比：变化按首场与末场计算', () => {
    const e1 = makeExam('e1', '月考一', [
      ['甲', 100, 50],
      ['乙', 90, 50],
      ['丙', 80, 50],
    ])
    const e2 = makeExam('e2', '月考二', [
      ['甲', 90, 50],
      ['乙', 90, 50],
      ['丙', 80, 50],
    ])
    const e3 = makeExam('e3', '期中', [
      ['甲', 70, 50],
      ['乙', 95, 50],
      ['丙', 80, 50],
    ])
    const result = analyzeSeries([e1, e2, e3], OPTIONS)
    const byName = Object.fromEntries(result.students.map((student) => [student.name, student]))
    expect(byName['甲'].totals).toEqual([150, 140, 120])
    expect(byName['甲'].totalRanks).toEqual([1, 1, 3])
    expect(byName['甲'].totalRankDelta).toBe(-2)
    expect(byName['乙'].totalRankDelta).toBe(1)
    expect(byName['丙'].totalRankDelta).toBe(1)
    expect(result.counts.totalUp + result.counts.totalDown + result.counts.totalFlat).toBe(3)
    expect(result.examStats.map((stat) => stat.totalAvg)).toEqual([140, 136.67, 131.67])
  })

  it('演示数据为三场，规模与统计口径一致', () => {
    const demo = makeDemo()
    expect(demo.exams).toHaveLength(3)
    const result = analyzeSeries(demo.exams, demo.options)
    expect(result.students.length).toBe(47)
    expect(result.counts.examCounts).toEqual([47, 47, 46])
    expect(result.counts.comparableAll).toBe(46)
    expect(result.stats).toHaveLength(5)
    const subjectTotal = result.stats.reduce((sum, stat) => sum + stat.up + stat.down + stat.flat, 0)
    expect(subjectTotal).toBe(46 * 5)
  })
})



