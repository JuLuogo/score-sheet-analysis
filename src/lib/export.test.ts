import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { makeDemo } from './demo'
import { analyze } from './analyze'
import { buildWorkbook } from './export'

describe('export', () => {
  it('生成的工作簿包含预期工作表与数据', async () => {
    const demo = makeDemo()
    const result = analyze(demo.base, demo.target, demo.options)
    const workbook = await buildWorkbook(result, '测试班')
    const buffer = await workbook.xlsx.writeBuffer()

    const reader = new ExcelJS.Workbook()
    await reader.xlsx.load(buffer as ArrayBuffer)
    const names = reader.worksheets.map((sheet) => sheet.name)
    expect(names).toContain('汇总总览')
    expect(names).toContain('总分')
    expect(names).toContain('语文')
    expect(names).toContain('专业课')
    expect(names).toContain('科目统计')
    expect(names).toContain('说明')

    const summary = reader.getWorksheet('汇总总览')
    expect(summary).toBeTruthy()
    expect(String(summary!.getCell(1, 1).value)).toContain('测试班')
    expect(summary!.getCell(4, 2).value).toBe(result.students[0].name)
    expect(summary!.getCell(3, 1).value).toBe('序号')

    const total = reader.getWorksheet('总分')
    expect(total!.getCell(4, 2).value).toBe(result.students[0].name)
    expect(total!.getCell(4, 7).value).toBe(result.students[0].totalDelta)

    const stats = reader.getWorksheet('科目统计')
    expect(stats!.getCell(3, 1).value).toBe('科目')
    expect(stats!.getCell(4, 1).value).toBe('语文')
  })
})
