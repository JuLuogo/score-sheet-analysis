export type Cell = string | number | null

export interface SheetData {
  name: string
  rows: Cell[][]
}

export interface WorkbookData {
  fileName: string
  sheets: SheetData[]
}

export interface SubjectCol {
  name: string
  col: number
}

export interface ExamConfig {
  headerRow: number
  nameCol: number
  subjectCols: SubjectCol[]
  totalCol: number | null
  rankCol: number | null
}

export interface StudentRecord {
  id: string
  name: string
  scores: Record<string, number | null>
  total: number | null
  srcRank: number | null
}

export interface ExamData {
  id: string
  label: string
  fileName: string
  sheetName: string
  rows: Cell[][]
  config: ExamConfig
  subjects: string[]
  students: StudentRecord[]
  warnings: string[]
}

export type RankMode = 'competition' | 'sequential'

export interface AnalysisOptions {
  rankMode: RankMode
  bucketSize: number
  fullMarks: Record<string, number>
  /** 兼容旧数据；新版本按满分比例计算及格线 */
  passMarks: Record<string, number>
  /** 及格线占满分比例，默认 0.6 */
  passRatio?: number
  /** 优秀线占满分比例，默认 0.8 */
  excellentRatio?: number
}

export interface SeriesStudent {
  key: string
  name: string
  totals: (number | null)[]
  totalRanks: (number | null)[]
  scores: Record<string, (number | null)[]>
  ranks: Record<string, (number | null)[]>
  inExam: boolean[]
  totalDelta: number | null
  totalRankDelta: number | null
  scoreDeltas: Record<string, number | null>
  rankDeltas: Record<string, number | null>
  upCount: number
  downCount: number
  note: string
}

export interface SeriesExamStat {
  label: string
  count: number
  totalAvg: number | null
  totalMax: number | null
  totalMin: number | null
  subjectAvg: Record<string, number | null>
}

export interface SeriesSubjectStat {
  subject: string
  fullMark: number | null
  passMark: number | null
  firstAvg: number | null
  lastAvg: number | null
  avgDelta: number | null
  firstMax: number | null
  lastMax: number | null
  firstMin: number | null
  lastMin: number | null
  up: number
  down: number
  flat: number
  firstPassCount: number | null
  lastPassCount: number | null
  excellentMark: number | null
  firstPassRate: number | null
  lastPassRate: number | null
  firstExcellentCount: number | null
  lastExcellentCount: number | null
  firstExcellentRate: number | null
  lastExcellentRate: number | null
}

export interface BucketRow {
  label: string
  first: number
  last: number
}

export interface SeriesAnalysis {
  labels: string[]
  fileName: string
  subjects: string[]
  students: SeriesStudent[]
  examStats: SeriesExamStat[]
  stats: SeriesSubjectStat[]
  totalStat: SeriesSubjectStat
  buckets: BucketRow[]
  counts: {
    examCounts: number[]
    comparableAll: number
    firstOnly: number
    lastOnly: number
    totalUp: number
    totalDown: number
    totalFlat: number
    subjectUp: number
    subjectDown: number
  }
  warnings: string[]
  options: AnalysisOptions
}

export interface ExportSelection {
  summary: boolean
  total: boolean
  subjects: boolean
  stats: boolean
  notes: boolean
}

export interface Template {
  id: string
  name: string
  createdAt: number
  subjects: string[]
  subjectHeaders: string[]
  nameHeader: string | null
  totalHeader: string | null
  rankHeader: string | null
  options: AnalysisOptions
}

export interface ExamDraft {
  id: string
  label: string
  workbook: WorkbookData
  sheetIndex: number
  rows: Cell[][]
  headerRow: number
  config: ExamConfig
}

export interface HistoryItem {
  id: string
  createdAt: number
  title: string
  labels: string[]
  counts: SeriesAnalysis['counts']
  exams: ExamData[]
  options: AnalysisOptions
  selection: ExportSelection
}

