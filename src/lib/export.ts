import type { AnalysisResult, StudentAnalysis, SubjectStat } from '../types'
import { deltaWord, fmtDelta, fmtRankDelta, fmtScore } from './format'

const NAVY = 'FF1F3864'
const HEAD = 'FF2F5597'
const HEAD_FONT = 'FFFFFFFF'
const GREEN_FILL = 'FFC6EFCE'
const GREEN_FONT = 'FF006100'
const RED_FILL = 'FFFFC7CE'
const RED_FONT = 'FF9C0006'
const FLAT_FILL = 'FFEDEDED'
const FLAT_FONT = 'FF595959'
const NA_FONT = 'FF808080'
const BORDER = 'FFBFBFBF'

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function safeName(text: string) {
  return text.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
}

function stamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function applyDeltaStyle(cell: any, value: number | null, isRank: boolean) {
  if (value == null) {
    cell.font = { color: { argb: NA_FONT }, italic: true }
    return
  }
  if (value > 0) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_FILL } }
    cell.font = { color: { argb: GREEN_FONT }, bold: true }
  } else if (value < 0) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } }
    cell.font = { color: { argb: RED_FONT }, bold: true }
  } else {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FLAT_FILL } }
    cell.font = { color: { argb: FLAT_FONT } }
  }
  cell.numFmt = isRank ? '+0;-0;0' : '+0.0;-0.0;0.0'
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

function thinBorder(cell: any) {
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    bottom: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } },
  }
}

function writeTitle(ws: any, colCount: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, colCount)
  ws.mergeCells(2, 1, 2, colCount)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { size: 16, bold: true, color: { argb: NAVY } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  const subCell = ws.getCell(2, 1)
  subCell.value = subtitle
  subCell.font = { size: 9, italic: true, color: { argb: FLAT_FONT } }
  subCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30
  ws.getRow(2).height = 22
}

function writeHeader(ws: any, row: number, headers: string[]) {
  headers.forEach((text, index) => {
    const cell = ws.getCell(row, index + 1)
    cell.value = text
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } }
    cell.font = { bold: true, color: { argb: HEAD_FONT }, size: 10.5 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    thinBorder(cell)
  })
  ws.getRow(row).height = 38
}

function finishSheet(ws: any, lastRow: number, colCount: number, freeze = 'C4') {
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
  if (lastRow >= 4) {
    ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: lastRow, column: colCount } }
  }
  ws.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
  void freeze
}

function mergeWarnings(result: AnalysisResult) {
  const parts = [`基准：${result.baseLabel}（${result.baseFileName}）`, `对比：${result.targetLabel}（${result.targetFileName}）`]
  parts.push(`排名口径：${result.options.rankMode === 'competition' ? '并列名次（同分同名次，后续跳号）' : '顺序名次（同分按顺序编号）'}`)
  if (result.counts.baseOnly) parts.push(`${result.counts.baseOnly} 人仅基准考试有成绩`)
  if (result.counts.targetOnly) parts.push(`${result.counts.targetOnly} 人仅对比考试有成绩`)
  return parts.join('；')
}

export async function buildWorkbook(result: AnalysisResult, className = '成绩对比') {
  const mod = (await import('exceljs')) as unknown as { default?: unknown }
  const ExcelJS = (mod.default ?? mod) as any
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '成绩对比分析系统'
  workbook.created = new Date()

  const subjects = result.subjects
  const usedNames = new Set<string>()
  const safeSheet = (name: string) => {
    let base = String(name).replace(/[\\/*?:[\]]/g, '_').slice(0, 28) || 'Sheet'
    let candidate = base
    let index = 2
    while (usedNames.has(candidate)) {
      candidate = `${base}(${index})`
      index += 1
    }
    usedNames.add(candidate)
    return candidate
  }

  useSheetStats()

  // ---------------- 汇总总览
  const summary = workbook.addWorksheet(safeSheet('汇总总览'))
  const summaryHeaders = [
    '序号', '姓名', `${result.baseLabel}总分`, `${result.targetLabel}总分`, '总分变化',
    `${result.baseLabel}总分排名`, `${result.targetLabel}总分排名`, '总分排名变化',
    ...subjects.map((s) => `${s}名次变化`),
    '上升科目数', '下降科目数', '备注',
  ]
  writeTitle(summary, summaryHeaders.length, `${className} · 成绩对比总览`, mergeWarnings(result))
  writeHeader(summary, 3, summaryHeaders)
  result.students.forEach((student, index) => {
    const row = index + 4
    const values = [
      index + 1, student.name, student.baseTotal, student.targetTotal, student.totalDelta,
      student.baseTotalRank, student.targetTotalRank, student.totalRankDelta,
      ...subjects.map((s) => student.rankDeltas[s]),
      student.inTarget ? student.upCount : null,
      student.inTarget ? student.downCount : null,
      student.inBase ? (student.inTarget ? '' : '仅基准考试有成绩') : '仅对比考试有成绩',
    ]
    values.forEach((value, col) => {
      const cell = summary.getCell(row, col + 1)
      cell.value = value as never
      thinBorder(cell)
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' }
    })
    summary.getCell(row, 1).value = index + 1
    summary.getCell(row, 2).value = student.name
    summary.getCell(row, 2).font = { bold: true }
    summary.getCell(row, 5).numFmt = '+0.0;-0.0;0.0'
    applyDeltaStyle(summary.getCell(row, 5), student.totalDelta, false)
    applyDeltaStyle(summary.getCell(row, 8), student.totalRankDelta, true)
    subjects.forEach((subject, subjectIndex) => {
      applyDeltaStyle(summary.getCell(row, 9 + subjectIndex), student.rankDeltas[subject], true)
    })
    summary.getRow(row).height = 22
  })
  const summaryWidths = summaryHeaders.map((_, index) => {
    if (index === 0) return 6
    if (index === 1) return 12
    if (index === 2 || index === 3) return 14
    if (index === summaryHeaders.length - 1) return 20
    return 11
  })
  summaryWidths.forEach((width, index) => {
    summary.getColumn(index + 1).width = width
  })
  finishSheet(summary, result.students.length + 3, summaryHeaders.length)

  // ---------------- 明细表（总分 + 各科）
  const detailRows = (getter: (student: StudentAnalysis) => {
    baseScore: number | null
    targetScore: number | null
    baseRank: number | null
    targetRank: number | null
    scoreDelta: number | null
    rankDelta: number | null
  }) => {
    const rows: any[][] = []
    result.students.forEach((student, index) => {
      const values = getter(student)
      rows.push([
        index + 1,
        student.name,
        values.baseScore,
        values.baseRank,
        values.targetScore,
        values.targetRank,
        values.scoreDelta,
        values.rankDelta,
        deltaWord(values.rankDelta),
        values.rankDelta == null ? (student.inBase ? '仅基准考试有成绩' : '仅对比考试有成绩') : '',
        student.baseSrcRank,
        student.targetSrcRank,
      ])
    })
    return rows
  }

  const detailHeaders = [
    '序号', '姓名', `${result.baseLabel}分数`, `${result.baseLabel}排名`,
    `${result.targetLabel}分数`, `${result.targetLabel}排名`, '分数变化', '排名变化',
    '变动说明', '备注', '原表基准排名', '原表对比排名',
  ]

  const totalSheet = workbook.addWorksheet(safeSheet('总分'))
  writeTitle(totalSheet, detailHeaders.length, '总分 · 排名升降对比', mergeWarnings(result))
  writeHeader(totalSheet, 3, detailHeaders)
  detailRows((student) => ({
    baseScore: student.baseTotal,
    targetScore: student.targetTotal,
    baseRank: student.baseTotalRank,
    targetRank: student.targetTotalRank,
    scoreDelta: student.totalDelta,
    rankDelta: student.totalRankDelta,
  })).forEach((values, index) => {
    const row = index + 4
    values.forEach((value, col) => {
      const cell = totalSheet.getCell(row, col + 1)
      cell.value = value as never
      thinBorder(cell)
      cell.alignment = { horizontal: col === 2 || col === 9 || col === 10 ? 'left' : 'center', vertical: 'middle' }
      if (col === 2) cell.font = { bold: true }
    })
    applyDeltaStyle(totalSheet.getCell(row, 7), values[6], false)
    applyDeltaStyle(totalSheet.getCell(row, 8), values[7], true)
    applyDeltaStyle(totalSheet.getCell(row, 9), values[7], true)
    totalSheet.getRow(row).height = 22
  })
  ;[6, 12, 12, 12, 12, 12, 12, 12, 15, 18, 12, 12].forEach((width, index) => {
    totalSheet.getColumn(index + 1).width = width
  })
  finishSheet(totalSheet, result.students.length + 3, detailHeaders.length)

  for (const subject of subjects) {
    const sheet = workbook.addWorksheet(safeSheet(subject))
    writeTitle(sheet, detailHeaders.length, `${subject} · 单科排名升降对比`, mergeWarnings(result))
    writeHeader(sheet, 3, detailHeaders)
    detailRows((student) => ({
      baseScore: student.baseScores[subject],
      targetScore: student.targetScores[subject],
      baseRank: student.baseRanks[subject],
      targetRank: student.targetRanks[subject],
      scoreDelta: student.scoreDeltas[subject],
      rankDelta: student.rankDeltas[subject],
    })).forEach((values, index) => {
      const row = index + 4
      values.forEach((value, col) => {
        const cell = sheet.getCell(row, col + 1)
        cell.value = value as never
        thinBorder(cell)
        cell.alignment = { horizontal: col === 2 || col === 9 || col === 10 ? 'left' : 'center', vertical: 'middle' }
        if (col === 2) cell.font = { bold: true }
      })
      applyDeltaStyle(sheet.getCell(row, 7), values[6], false)
      applyDeltaStyle(sheet.getCell(row, 8), values[7], true)
      applyDeltaStyle(sheet.getCell(row, 9), values[7], true)
      sheet.getRow(row).height = 22
    })
    ;[6, 12, 12, 12, 12, 12, 12, 12, 15, 18, 12, 12].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width
    })
    finishSheet(sheet, result.students.length + 3, detailHeaders.length)
  }

  // ---------------- 科目统计
  const statsSheet = workbook.addWorksheet(safeSheet('科目统计'))
  const statHeaders = [
    '科目', '满分', '基准人数', '对比人数', '基准均分', '对比均分', '均分变化',
    '基准最高', '对比最高', '基准最低', '对比最低', '名次上升', '名次下降', '名次持平',
    '及格线', '基准及格', '对比及格',
  ]
  writeTitle(statsSheet, statHeaders.length, `${className} · 科目统计`, mergeWarnings(result))
  writeHeader(statsSheet, 3, statHeaders)
  const allStats: SubjectStat[] = [...result.stats, result.totalStat]
  allStats.forEach((stat, index) => {
    const row = index + 4
    const values = [
      stat.subject, stat.fullMark, stat.baseCount, stat.targetCount,
      stat.baseAvg, stat.targetAvg, stat.avgDelta, stat.baseMax, stat.targetMax,
      stat.baseMin, stat.targetMin, stat.up, stat.down, stat.flat,
      stat.passMark, stat.basePassCount, stat.targetPassCount,
    ]
    values.forEach((value, col) => {
      const cell = statsSheet.getCell(row, col + 1)
      cell.value = value as never
      thinBorder(cell)
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      if (col === 0) cell.font = { bold: true }
    })
    applyDeltaStyle(statsSheet.getCell(row, 7), stat.avgDelta, false)
    statsSheet.getRow(row).height = 24
  })
  ;[10, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10].forEach((width, index) => {
    statsSheet.getColumn(index + 1).width = width
  })
  finishSheet(statsSheet, allStats.length + 3, statHeaders.length)

  // ---------------- 说明
  const notes = workbook.addWorksheet(safeSheet('说明'))
  notes.getColumn(1).width = 4
  notes.getColumn(2).width = 110
  const lines = [
    ['说明', ''],
    ['', `生成时间：${new Date().toLocaleString('zh-CN')}`],
    ['', `基准考试：${result.baseLabel}（文件：${result.baseFileName}）`],
    ['', `对比考试：${result.targetLabel}（文件：${result.targetFileName}）`],
    ['', `参考人数：基准 ${result.counts.baseCount} 人，对比 ${result.counts.targetCount} 人，可比 ${result.counts.comparable} 人`],
    ['', `排名口径：${result.options.rankMode === 'competition' ? '并列名次（同分同名次，后续名次跳号）' : '顺序名次（同分按出现顺序编号）'}`],
    ['', '排名变化 = 基准名次 − 对比名次：正数表示名次上升，负数表示名次下降，0 表示持平。'],
    ['', '分数变化 = 对比分数 − 基准分数。分数受试卷难度影响，建议结合名次变化判断进退。'],
    ['', '总分：若原表提供总分列则直接使用，否则按所选科目求和。'],
    ['', '本文件由“成绩对比分析系统”生成，所有计算在前端完成，学生原始数据未被上传。'],
  ]
  if (result.warnings.length) {
    lines.push(['', '数据提醒：'])
    result.warnings.forEach((warning) => lines.push(['', `· ${warning}`]))
  }
  lines.forEach(([head, body], index) => {
    const row = index + 1
    if (head) {
      const cell = notes.getCell(row, 1)
      cell.value = head
      cell.font = { size: 14, bold: true, color: { argb: NAVY } }
    }
    const cell = notes.getCell(row, 2)
    cell.value = body
    cell.font = { size: 10.5 }
    cell.alignment = { wrapText: true, vertical: 'middle' }
  })

  return workbook
}

export async function exportXlsx(result: AnalysisResult, className = '成绩对比') {
  const workbook = await buildWorkbook(result, className)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  download(blob, `${safeName(className)}_成绩对比_${stamp()}.xlsx`)
}

function useSheetStats() {
  // 预留：如需统计工作表数量可在此扩展
}

export function exportCsv(result: AnalysisResult, className = '成绩对比') {
  const header = [
    '序号', '姓名', `${result.baseLabel}总分`, `${result.targetLabel}总分`, '总分变化',
    `${result.baseLabel}总分排名`, `${result.targetLabel}总分排名`, '总分排名变化',
    ...result.subjects.map((s) => `${s}名次变化`), '上升科目数', '下降科目数', '备注',
  ]
  const lines = [header.join(',')]
  result.students.forEach((student, index) => {
    const values = [
      index + 1, student.name, fmtScore(student.baseTotal), fmtScore(student.targetTotal),
      fmtDelta(student.totalDelta), fmtScore(student.baseTotalRank), fmtScore(student.targetTotalRank),
      fmtRankDelta(student.totalRankDelta),
      ...result.subjects.map((s) => fmtRankDelta(student.rankDeltas[s])),
      student.inTarget ? student.upCount : '', student.inTarget ? student.downCount : '',
      student.inBase ? (student.inTarget ? '' : '仅基准考试有成绩') : '仅对比考试有成绩',
    ]
    lines.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  download(blob, `${safeName(className)}_成绩对比_${stamp()}.csv`)
}



