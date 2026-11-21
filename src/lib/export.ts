import type { ExportSelection, SeriesAnalysis, SeriesStudent } from '../types'
import { deltaWord, fmtDelta, fmtRankDelta, fmtScore } from './format'

const NAVY = 'FF1F3864'
const HEAD = 'FF2F5597'
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
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function applyDelta(cell: any, value: number | null, isRank: boolean) {
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
}

function border(cell: any) {
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    bottom: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } },
  }
}

function title(ws: any, cols: number, text: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, cols)
  ws.mergeCells(2, 1, 2, cols)
  const main = ws.getCell(1, 1)
  main.value = text
  main.font = { size: 16, bold: true, color: { argb: NAVY } }
  main.alignment = { horizontal: 'center', vertical: 'middle' }
  const sub = ws.getCell(2, 1)
  sub.value = subtitle
  sub.font = { size: 9, italic: true, color: { argb: FLAT_FONT } }
  sub.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30
  ws.getRow(2).height = 22
}

function headerRow(ws: any, row: number, headers: string[]) {
  headers.forEach((text, index) => {
    const cell = ws.getCell(row, index + 1)
    cell.value = text
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    border(cell)
  })
  ws.getRow(row).height = 40
}

function finish(ws: any, lastRow: number, cols: number) {
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
  if (lastRow >= 4) ws.autoFilter = { from: { row: 3, column: 2 }, to: { row: lastRow, column: cols } }
  ws.pageSetup = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
}

function subtitleOf(result: SeriesAnalysis) {
  const parts = [
    `共 ${result.labels.length} 场：${result.labels.join(' → ')}`,
    `基准：${result.labels[0]}`,
    `排名口径：${result.options.rankMode === 'competition' ? '并列名次（同分同名次，后续跳号）' : '顺序名次（同分按顺序编号）'}`,
    `及格线：满分的 ${Math.round((result.options.passRatio ?? 0.6) * 100)}%；优秀线：满分的 ${Math.round((result.options.excellentRatio ?? 0.8) * 100)}%`,
  ]
  if (result.counts.comparableAll) parts.push(`全程参考 ${result.counts.comparableAll} 人`)
  return parts.join('；')
}

/** 生成多场对比工作簿（按导出内容选择工作表） */
export async function buildWorkbook(
  result: SeriesAnalysis,
  className: string,
  selection: ExportSelection,
) {
  const mod = (await import('exceljs')) as unknown as { default?: unknown }
  const ExcelJS = (mod.default ?? mod) as any
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '成绩单数据分析'
  workbook.created = new Date()

  const labels = result.labels
  const used = new Set<string>()
  const sheetName = (name: string) => {
    const base = String(name).replace(/[\\/*?:[\]]/g, '_').slice(0, 28) || 'Sheet'
    let candidate = base
    let index = 2
    while (used.has(candidate)) {
      candidate = `${base}(${index})`
      index += 1
    }
    used.add(candidate)
    return candidate
  }

  const wantAny =
    selection.summary || selection.total || selection.subjects || selection.stats || selection.notes

  if (selection.summary || !wantAny) {
    const ws = workbook.addWorksheet(sheetName('汇总总览'))
    const headers = [
      '序号',
      '姓名',
      ...labels.flatMap((label) => [`${label}总分`, `${label}排名`]),
      '总分变化（首→末）',
      '排名变化（首→末）',
      ...result.subjects.map((subject) => `${subject}名次变化`),
      '上升科目数',
      '下降科目数',
      '备注',
    ]
    title(ws, headers.length, `${className} · 多场成绩对比总览`, subtitleOf(result))
    headerRow(ws, 3, headers)
    result.students.forEach((student, index) => {
      const row = index + 4
      let col = 1
      ws.getCell(row, col++).value = index + 1
      ws.getCell(row, col++).value = student.name
      labels.forEach((_, examIndex) => {
        ws.getCell(row, col++).value = student.totals[examIndex]
        ws.getCell(row, col++).value = student.totalRanks[examIndex]
      })
      const totalDeltaCell = ws.getCell(row, col++)
      totalDeltaCell.value = student.totalDelta
      applyDelta(totalDeltaCell, student.totalDelta, false)
      const rankDeltaCell = ws.getCell(row, col++)
      rankDeltaCell.value = student.totalRankDelta
      applyDelta(rankDeltaCell, student.totalRankDelta, true)
      result.subjects.forEach((subject) => {
        const cell = ws.getCell(row, col++)
        cell.value = student.rankDeltas[subject]
        applyDelta(cell, student.rankDeltas[subject], true)
      })
      ws.getCell(row, col++).value = student.upCount
      ws.getCell(row, col++).value = student.downCount
      ws.getCell(row, col++).value = student.note
      for (let c = 1; c <= headers.length; c += 1) {
        border(ws.getCell(row, c))
        ws.getCell(row, c).alignment = {
          horizontal: c === 2 || c === headers.length ? 'left' : 'center',
          vertical: 'middle',
        }
      }
      ws.getCell(row, 2).font = { bold: true }
      ws.getRow(row).height = 22
    })
    const widths = headers.map((_, index) => {
      if (index === 0) return 6
      if (index === 1) return 12
      if (index === headers.length - 1) return 20
      return 11
    })
    widths.forEach((width, index) => {
      ws.getColumn(index + 1).width = width
    })
    finish(ws, result.students.length + 3, headers.length)
  }

  const detailSheet = (name: string, subject: string | null) => {
    const ws = workbook.addWorksheet(sheetName(name))
    const headers = [
      '序号',
      '姓名',
      ...labels.flatMap((label) => [`${label}${subject ? '分数' : '分数'}`, `${label}排名`]),
      '分数变化（首→末）',
      '排名变化（首→末）',
      '变动说明',
      '备注',
    ]
    title(
      ws,
      headers.length,
      `${subject ?? '总分'} · 多场横向对比`,
      subject ? `${subtitleOf(result)}；科目：${subject}` : subtitleOf(result),
    )
    headerRow(ws, 3, headers)
    result.students.forEach((student, index) => {
      const row = index + 4
      let col = 1
      ws.getCell(row, col++).value = index + 1
      ws.getCell(row, col++).value = student.name
      labels.forEach((_, examIndex) => {
        ws.getCell(row, col++).value = subject
          ? student.scores[subject][examIndex]
          : student.totals[examIndex]
        ws.getCell(row, col++).value = subject ? student.ranks[subject][examIndex] : student.totalRanks[examIndex]
      })
      const scoreDelta = subject ? student.scoreDeltas[subject] : student.totalDelta
      const rankDelta = subject ? student.rankDeltas[subject] : student.totalRankDelta
      const scoreCell = ws.getCell(row, col++)
      scoreCell.value = scoreDelta
      applyDelta(scoreCell, scoreDelta, false)
      const rankCell = ws.getCell(row, col++)
      rankCell.value = rankDelta
      applyDelta(rankCell, rankDelta, true)
      ws.getCell(row, col++).value = deltaWord(rankDelta)
      ws.getCell(row, col++).value = student.note
      for (let c = 1; c <= headers.length; c += 1) {
        border(ws.getCell(row, c))
        ws.getCell(row, c).alignment = {
          horizontal: c === 2 || c >= headers.length - 1 ? 'left' : 'center',
          vertical: 'middle',
        }
      }
      ws.getCell(row, 2).font = { bold: true }
      ws.getRow(row).height = 22
    })
    const widths = headers.map((_, index) => {
      if (index === 0) return 6
      if (index === 1) return 12
      if (index >= headers.length - 2) return 16
      return 11
    })
    widths.forEach((width, index) => {
      ws.getColumn(index + 1).width = width
    })
    finish(ws, result.students.length + 3, headers.length)
  }

  if (selection.total) detailSheet('总分', null)
  if (selection.subjects) result.subjects.forEach((subject) => detailSheet(subject, subject))

  if (selection.stats) {
    const ws = workbook.addWorksheet(sheetName('科目统计'))
    const headers = [
      '科目',
      '满分',
      `${labels[0]}均分`,
      `${labels[labels.length - 1]}均分`,
      '均分变化',
      `${labels[0]}最高`,
      `${labels[labels.length - 1]}最高`,
      `${labels[0]}最低`,
      `${labels[labels.length - 1]}最低`,
      '名次上升',
      '名次下降',
      '名次持平',
      '及格线',
      '优秀线',
      '首场及格',
      '末场及格',
      '首场及格率',
      '末场及格率',
      '首场优秀',
      '末场优秀',
      '首场优秀率',
      '末场优秀率',
    ]
    title(ws, headers.length, `${className} · 科目统计`, subtitleOf(result))
    headerRow(ws, 3, headers)
    ;[...result.stats, result.totalStat].forEach((stat, index) => {
      const row = index + 4
      const values = [
        stat.subject,
        stat.fullMark,
        stat.firstAvg,
        stat.lastAvg,
        stat.avgDelta,
        stat.firstMax,
        stat.lastMax,
        stat.firstMin,
        stat.lastMin,
        stat.up,
        stat.down,
        stat.flat,
        stat.passMark,
        stat.excellentMark,
        stat.firstPassCount,
        stat.lastPassCount,
        stat.firstPassRate,
        stat.lastPassRate,
        stat.firstExcellentCount,
        stat.lastExcellentCount,
        stat.firstExcellentRate,
        stat.lastExcellentRate,
      ]
      values.forEach((value, col) => {
        const cell = ws.getCell(row, col + 1)
        cell.value = value as never
        border(cell)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (col === 0) cell.font = { bold: true }
        if ([16, 17, 20, 21].includes(col) && value != null) cell.numFmt = '0.0"%"'
      })
      applyDelta(ws.getCell(row, 5), stat.avgDelta, false)
      ws.getRow(row).height = 24
    })
    const widths = Array.from({ length: headers.length }, () => 10)
    widths[0] = 10
    widths[1] = 8
    widths.forEach((width, index) => {
      ws.getColumn(index + 1).width = width
    })
    finish(ws, result.stats.length + 4, headers.length)
  }

  if (selection.notes) {
    const ws = workbook.addWorksheet(sheetName('说明'))
    ws.getColumn(1).width = 4
    ws.getColumn(2).width = 110
    const lines: [string, string][] = [
      ['说明', ''],
      ['', `生成时间：${new Date().toLocaleString('zh-CN')}`],
      ['', `考试场次（按顺序）：${labels.join(' → ')}`],
      ['', `参考人数：${labels.map((label, index) => `${label} ${result.counts.examCounts[index]} 人`).join('，')}`],
      ['', `全程参考：${result.counts.comparableAll} 人；仅首场：${result.counts.firstOnly} 人；仅末场：${result.counts.lastOnly} 人`],
      ['', `排名口径：${result.options.rankMode === 'competition' ? '并列名次（同分同名次，后续名次跳号）' : '顺序名次（同分按顺序编号）'}`],
      ['', '排名变化 = 首场名次 − 末场名次：正数表示名次上升，负数表示名次下降，0 表示持平。'],
      ['', '分数变化 = 末场分数 − 首场分数；中间场次仅展示分数与排名，不单独计算变化。'],
      ['', '总分：若原表提供总分列则直接使用，否则按所选科目求和。'],
      ['', '本文件由“成绩单数据分析”生成，所有计算在浏览器本地完成。'],
    ]
    if (result.warnings.length) {
      lines.push(['', '数据提醒：'])
      result.warnings.forEach((warning) => lines.push(['', `· ${warning}`]))
    }
    lines.forEach(([head, body], index) => {
      const row = index + 1
      if (head) {
        const cell = ws.getCell(row, 1)
        cell.value = head
        cell.font = { size: 14, bold: true, color: { argb: NAVY } }
      }
      const cell = ws.getCell(row, 2)
      cell.value = body
      cell.font = { size: 10.5 }
      cell.alignment = { wrapText: true, vertical: 'middle' }
    })
  }

  return workbook
}

export async function exportXlsx(
  result: SeriesAnalysis,
  className: string,
  selection: ExportSelection,
) {
  const workbook = await buildWorkbook(result, className, selection)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  download(blob, `${safeName(className)}_${safeName(result.labels.join('-'))}_成绩分析_${stamp()}.xlsx`)
}

export function exportCsv(result: SeriesAnalysis, className: string) {
  const header = [
    '序号',
    '姓名',
    ...result.labels.flatMap((label) => [`${label}总分`, `${label}排名`]),
    '总分变化',
    '排名变化',
    ...result.subjects.map((subject) => `${subject}名次变化`),
    '上升科目数',
    '下降科目数',
    '备注',
  ]
  const lines = [header.join(',')]
  result.students.forEach((student: SeriesStudent, index: number) => {
    const values = [
      index + 1,
      student.name,
      ...result.labels.flatMap((_, examIndex) => [
        fmtScore(student.totals[examIndex]),
        student.totalRanks[examIndex] ?? '',
      ]),
      fmtDelta(student.totalDelta),
      fmtRankDelta(student.totalRankDelta),
      ...result.subjects.map((subject) => fmtRankDelta(student.rankDeltas[subject])),
      student.upCount,
      student.downCount,
      student.note,
    ]
    lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
  })
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  download(blob, `${safeName(className)}_${safeName(result.labels.join('-'))}_成绩分析_${stamp()}.csv`)
}




