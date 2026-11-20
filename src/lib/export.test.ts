import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { makeDemo } from './demo'
import { analyzeSeries } from './analyze'
import { buildWorkbook } from './export'

describe('export', () => {
  it('按选择生成工作表并写入矩阵数据', async () => {
    const demo = makeDemo()
    const result = analyzeSeries(demo.exams, demo.options)
    const workbook = await buildWorkbook(result, '测试班', {
      summary: true,
      total: true,
      subjects: false,
      stats: true,
      notes: true,
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const reader = new ExcelJS.Workbook()
    await reader.xlsx.load(buffer as ArrayBuffer)

    const names = reader.worksheets.map((sheet) => sheet.name)
    expect(names).toEqual(['汇总总览', '总分', '科目统计', '说明'])
    expect(names).not.toContain('语文')

    const summary = reader.getWorksheet('汇总总览')!
    expect(String(summary.getCell(1, 1).value)).toContain('测试班')
    expect(summary.getCell(3, 1).value).toBe('序号')
    // 3 场：序号、姓名 + 3×2 列 + 变化列
    expect(summary.getCell(3, 3).value).toBe('第一次月考总分')
    expect(summary.getCell(3, 7).value).toBe('期中考试总分')
    expect(summary.getCell(4, 2).value).toBe(result.students[0].name)
  })
})

