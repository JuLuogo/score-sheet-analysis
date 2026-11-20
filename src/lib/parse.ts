import type {
  Cell,
  ExamConfig,
  ExamData,
  ExamRole,
  SheetData,
  StudentRecord,
  WorkbookData,
} from '../types'
import { round2 } from './format'

const SUMMARY_NAMES = /^(最高分|最低分|平均分|及格率|优秀率|合计|小计|班级|人数|参考人数)$/
const NAME_HEADER = /^(姓名|学生姓名|学生|名字|考生姓名|考生)$/
const ID_HEADER = /^(序号|编号|学号|考号|考生号)$/
const TOTAL_HEADER = /^(总分|总成绩|合计|总分数|合计总分)$/
const RANK_HEADER = /^(排名|名次|班级排名|年级排名|总分排名)$/

/** ExcelJS 单元格值 → 纯文本/数字 */
function normalizeCell(value: unknown): Cell {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text?: string }[])
        .map((part) => part.text ?? '')
        .join('')
        .trim()
    }
    if ('result' in obj) return normalizeCell(obj.result)
    if ('text' in obj) return normalizeCell(obj.text)
    if (obj.error) return null
  }
  return String(value)
}

export function toNumber(value: Cell | undefined | null): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value)
    .replace(/[，,\s%]/g, '')
    .replace(/分$/, '')
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row.map((v) => v.replace(/\r$/, '').trim()))
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row.map((v) => v.replace(/\r$/, '').trim()))
  return rows
}

/** 读取 .xlsx / .xlsm / .csv，返回每个工作表的二维数据 */
export async function parseFile(file: File): Promise<WorkbookData> {
  const name = file.name
  if (/\.csv$/i.test(name)) {
    const text = await file.text()
    return { fileName: name, sheets: [{ name: 'CSV', rows: parseCsv(text) }] }
  }
  if (/\.xls$/i.test(name)) {
    throw new Error('暂不支持旧版 .xls，请先用 Excel / WPS 另存为 .xlsx 再上传')
  }
  if (!/\.(xlsx|xlsm)$/i.test(name)) {
    throw new Error('仅支持 .xlsx / .xlsm / .csv 文件')
  }
  const mod = (await import('exceljs')) as unknown as { default?: unknown }
  const ExcelJS = (mod.default ?? mod) as {
    Workbook: new () => {
      xlsx: { load: (data: ArrayBuffer) => Promise<unknown> }
      worksheets: {
        name: string
        rowCount: number
        columnCount: number
        getRow: (r: number) => {
          getCell: (c: number) => { value: unknown }
        }
      }[]
    }
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheets: SheetData[] = workbook.worksheets.map((sheet) => {
    const rowCount = Math.min(sheet.rowCount || 0, 3000)
    const colCount = Math.min(sheet.columnCount || 0, 60)
    const rows: Cell[][] = []
    for (let r = 1; r <= rowCount; r += 1) {
      const line = sheet.getRow(r)
      const cells: Cell[] = []
      for (let c = 1; c <= colCount; c += 1) {
        cells.push(normalizeCell(line.getCell(c).value))
      }
      rows.push(cells)
    }
    return { name: sheet.name, rows }
  })
  if (!sheets.length) throw new Error('文件中没有可读取的工作表')
  return { fileName: name, sheets }
}

function isEmptyRow(row: Cell[] | undefined): boolean {
  return !row || row.every((cell) => cell == null || String(cell).trim() === '')
}

function countNumbers(row: Cell[] | undefined): number {
  if (!row) return 0
  return row.filter((cell) => toNumber(cell) != null).length
}

function countText(row: Cell[] | undefined): number {
  if (!row) return 0
  return row.filter((cell) => typeof cell === 'string' && cell.trim() !== '' && toNumber(cell) == null).length
}

/** 猜测表头所在行（0 起） */
export function detectHeaderRow(rows: Cell[][]): number {
  const limit = Math.min(rows.length, 12)
  let best = 0
  let bestScore = -1
  for (let i = 0; i < limit; i += 1) {
    const text = countText(rows[i])
    const below = countNumbers(rows[i + 1]) + countNumbers(rows[i + 2])
    const score = text * 3 + Math.min(below, 10) + (isEmptyRow(rows[i]) ? -20 : 0)
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

function headerText(row: Cell[] | undefined, col: number): string {
  const value = row?.[col]
  return value == null ? '' : String(value).trim()
}

function columnHasNumbers(rows: Cell[][], headerRow: number, col: number): boolean {
  let hits = 0
  const end = Math.min(rows.length, headerRow + 9)
  for (let i = headerRow + 1; i < end; i += 1) {
    if (toNumber(rows[i]?.[col]) != null) hits += 1
  }
  return hits > 0
}

/** 根据表头与分析习惯猜测列映射 */
export function guessConfig(rows: Cell[][], headerRow: number): ExamConfig {
  const header = rows[headerRow] ?? []
  const width = Math.max(...rows.slice(headerRow, headerRow + 10).map((r) => r.length), header.length, 1)

  let nameCol = -1
  let idCol = -1
  let totalCol: number | null = null
  let rankCol: number | null = null

  for (let c = 0; c < width; c += 1) {
    const text = headerText(header, c)
    if (nameCol < 0 && NAME_HEADER.test(text)) nameCol = c
    if (idCol < 0 && ID_HEADER.test(text)) idCol = c
    if (totalCol == null && TOTAL_HEADER.test(text)) totalCol = c
    if (rankCol == null && RANK_HEADER.test(text)) rankCol = c
  }

  if (nameCol < 0) {
    for (let c = 0; c < width; c += 1) {
      if (c === idCol || c === totalCol || c === rankCol) continue
      const text = headerText(header, c)
      if (text && !columnHasNumbers(rows, headerRow, c)) {
        nameCol = c
        break
      }
    }
  }
  if (nameCol < 0) nameCol = 0

  const subjectCols: ExamConfig['subjectCols'] = []
  for (let c = 0; c < width; c += 1) {
    if (c === nameCol || c === idCol || c === totalCol || c === rankCol) continue
    const text = headerText(header, c)
    if (!text) continue
    if (!columnHasNumbers(rows, headerRow, c)) continue
    subjectCols.push({ name: text, col: c })
  }

  if (!subjectCols.length) {
    for (let c = 0; c < width; c += 1) {
      if (c === nameCol || c === idCol || c === totalCol || c === rankCol) continue
      if (columnHasNumbers(rows, headerRow, c)) {
        subjectCols.push({ name: headerText(header, c) || `科目${c + 1}`, col: c })
      }
    }
  }

  return { headerRow, nameCol, subjectCols, totalCol, rankCol }
}

export interface BuildExamParams {
  role: ExamRole
  label: string
  fileName: string
  sheetName: string
  rows: Cell[][]
  config: ExamConfig
}

/** 依据映射把二维表转成学生记录 */
export function buildExam(params: BuildExamParams): ExamData {
  const { role, label, fileName, sheetName, rows, config } = params
  const warnings: string[] = []

  const subjects: string[] = []
  const used = new Map<string, number>()
  for (const item of config.subjectCols) {
    const base = item.name.trim() || `科目${item.col + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    subjects.push(count === 0 ? base : `${base}(${count + 1})`)
  }

  const students: StudentRecord[] = []
  const nameCount = new Map<string, number>()
  const end = Math.min(rows.length, 3000)
  let skipped = 0
  let totalMismatch = 0

  for (let r = config.headerRow + 1; r < end; r += 1) {
    const row = rows[r]
    if (isEmptyRow(row)) continue
    const rawName = row?.[config.nameCol]
    const name = rawName == null ? '' : String(rawName).trim()
    if (!name) {
      skipped += 1
      continue
    }
    if (SUMMARY_NAMES.test(name)) continue
    if (!students.length && config.headerRow >= 0 && name === headerText(rows[config.headerRow], config.nameCol)) {
      continue
    }

    const scores: Record<string, number | null> = {}
    let sum = 0
    let numericCount = 0
    subjects.forEach((subject, idx) => {
      const value = toNumber(row?.[config.subjectCols[idx].col])
      scores[subject] = value
      if (value != null) {
        sum += value
        numericCount += 1
      }
    })

    const declaredTotal = config.totalCol == null ? null : toNumber(row?.[config.totalCol])
    const total = declaredTotal != null ? declaredTotal : numericCount ? round2(sum) : null
    if (declaredTotal != null && numericCount) {
      if (Math.abs(declaredTotal - sum) > 0.51) totalMismatch += 1
    }

    const exists = nameCount.get(name) ?? 0
    nameCount.set(name, exists + 1)
    const id = exists === 0 ? name : `${name}#${exists + 1}`
    if (exists > 0) warnings.push(`「${name}」重名，已按出现顺序编号区分`)

    students.push({
      id,
      name,
      scores,
      total,
      srcRank: config.rankCol == null ? null : toNumber(row?.[config.rankCol]),
    })
  }

  if (!students.length) throw new Error(`${label}：没有识别到学生数据，请检查表头/姓名列`)
  if (skipped) warnings.push(`${label}：跳过 ${skipped} 行没有姓名的数据`)
  if (totalMismatch) warnings.push(`${label}：${totalMismatch} 行“总分”与各科之和不一致，已按表内总分计算`)
  if (subjects.length === 0) throw new Error(`${label}：没有识别到科目列`)
  if (config.totalCol == null) warnings.push(`${label}：未指定总分列，总分按科目求和`)

  return {
    role,
    label,
    fileName,
    sheetName,
    rows,
    config,
    subjects,
    students,
    warnings,
  }
}
