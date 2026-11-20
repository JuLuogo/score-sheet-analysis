import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import type { Cell, ExamConfig, ExamData } from '../types'
import { buildExam, detectHeaderRow, guessConfig, parseFile } from './parse'
import { analyzeSeries } from './analyze'
import { buildWorkbook } from './export'

const OPTIONS = {
  rankMode: 'competition' as const,
  bucketSize: 50,
  fullMarks: {},
  passMarks: {},
}

function examFromRows(id: string, label: string, rows: Cell[][], headerRow = 0): ExamData {
  const config = guessConfig(rows, headerRow)
  return buildExam({ id, label, fileName: `${label}.xlsx`, sheetName: 'Sheet1', rows, config })
}

describe('无排名 / 无总分成绩单', () => {
  it('只有姓名与科目也能构建，名次为空、总分自动求和', () => {
    const rows: Cell[][] = [
      ['姓名', '语文', '数学', '英语'],
      ['张三', 90, 80, 70],
      ['李四', 85, 75, 60],
    ]
    const config = guessConfig(rows, 0)
    expect(config.rankCol).toBeNull()
    expect(config.totalCol).toBeNull()
    expect(config.nameCol).toBe(0)
    expect(config.subjectCols.map((item) => item.name)).toEqual(['语文', '数学', '英语'])

    const exam = examFromRows('e1', '月考', rows)
    expect(exam.students).toHaveLength(2)
    expect(exam.students[0].total).toBe(240)
    expect(exam.students[0].srcRank).toBeNull()
    expect(exam.warnings.some((warning) => warning.includes('总分按科目求和'))).toBe(true)
  })

  it('字符串数字、空行、统计行都能正确处理', () => {
    const rows: Cell[][] = [
      ['班级成绩'],
      ['姓名', '语文', '数学'],
      ['张三', '90', '80'],
      ['', '', ''],
      ['李四', 85, ''],
      ['平均分', 87.5, 80],
    ]
    const headerRow = detectHeaderRow(rows)
    const exam = examFromRows('e1', '月考', rows, headerRow)
    expect(exam.students.map((student) => student.name)).toEqual(['张三', '李四'])
    expect(exam.students[0].total).toBe(170)
    expect(exam.students[1].total).toBe(85)
  })
})

describe('多场分析的边界情况', () => {
  function make(id: string, label: string, students: [string, number, number][]): ExamData {
    const rows: Cell[][] = [['姓名', '语文', '数学']]
    students.forEach(([name, a, b]) => rows.push([name, a, b]))
    return examFromRows(id, label, rows)
  }

  it('并列名次、缺场与分数段统计一致', () => {
    const e1 = make('e1', '月考一', [
      ['甲', 100, 100],
      ['乙', 100, 100],
      ['丙', 90, 90],
    ])
    const e2 = make('e2', '月考二', [
      ['甲', 100, 100],
      ['乙', 100, 100],
      ['丙', 95, 95],
    ])
    const e3 = make('e3', '期中', [
      ['甲', 90, 90],
      ['丙', 95, 95],
    ])
    const result = analyzeSeries([e1, e2, e3], OPTIONS)
    const byName = Object.fromEntries(result.students.map((student) => [student.name, student]))

    expect(byName['甲'].totalRanks[0]).toBe(1)
    expect(byName['乙'].totalRanks[0]).toBe(1)
    expect(byName['丙'].totalRanks[0]).toBe(3)
    expect(byName['甲'].inExam).toEqual([true, true, true])
    expect(byName['乙'].inExam).toEqual([true, true, false])
    expect(byName['乙'].totalRankDelta).toBeNull()
    expect(byName['乙'].note).toContain('未参考')

    const bucketTarget = result.buckets.reduce((sum, bucket) => sum + bucket.first, 0)
    expect(bucketTarget).toBe(3)
    expect(result.counts.examCounts).toEqual([3, 3, 2])
    expect(result.counts.comparableAll).toBe(2)
  })

  it('顺序名次不跳号，且首末变化正确', () => {
    const e1 = make('e1', '月考', [
      ['甲', 100, 100],
      ['乙', 100, 100],
      ['丙', 90, 90],
    ])
    const e2 = make('e2', '期中', [
      ['甲', 100, 100],
      ['乙', 100, 100],
      ['丙', 95, 95],
    ])
    const result = analyzeSeries([e1, e2], { ...OPTIONS, rankMode: 'sequential' })
    const byName = Object.fromEntries(result.students.map((student) => [student.name, student]))
    expect(byName['丙'].totalRanks).toEqual([3, 3])
    expect(byName['丙'].totalRankDelta).toBe(0)
    expect(byName['甲'].totalRankDelta).toBe(0)
  })
})

describe('导出选择与无排名数据', () => {
  it('取消“各科分表”后不生成科目工作表，无排名数据也能导出', async () => {
    const e1 = examFromRows('e1', '月考', [
      ['姓名', '语文', '数学'],
      ['张三', 90, 80],
      ['李四', 85, 75],
    ])
    const e2 = examFromRows('e2', '期中', [
      ['姓名', '语文', '数学'],
      ['张三', 95, 85],
      ['李四', 80, 88],
    ])
    const result = analyzeSeries([e1, e2], OPTIONS)
    const workbook = await buildWorkbook(result, '测试班', {
      summary: true,
      total: true,
      subjects: false,
      stats: false,
      notes: true,
    })
    const reader = new ExcelJS.Workbook()
    await reader.xlsx.load((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
    expect(reader.worksheets.map((sheet) => sheet.name)).toEqual(['汇总总览', '总分', '说明'])
  })
})

describe('CSV 与重名', () => {
  it('CSV 可解析，重名学生自动编号并提示', async () => {
    const file = new File(
      ['姓名,语文,数学\n张三,90,80\n张三,70,60\n李四,85,75'],
      '成绩.csv',
      { type: 'text/csv' },
    )
    const workbook = await parseFile(file)
    expect(workbook.sheets).toHaveLength(1)
    const exam = buildExam({
      id: 'e1',
      label: 'CSV',
      fileName: workbook.fileName,
      sheetName: workbook.sheets[0].name,
      rows: workbook.sheets[0].rows,
      config: guessConfig(workbook.sheets[0].rows, 0),
    })
    expect(exam.students).toHaveLength(3)
    expect(exam.students[0].id).toBe('张三')
    expect(exam.students[1].id).toBe('张三#2')
    expect(exam.warnings.some((warning) => warning.includes('重名'))).toBe(true)
  })
})
