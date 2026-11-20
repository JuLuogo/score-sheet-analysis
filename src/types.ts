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
  /** 显示用的科目名，可在映射时修改 */
  name: string
  /** 在行数据中的列下标（0 起） */
  col: number
}

export interface ExamConfig {
  /** 表头所在行（0 起） */
  headerRow: number
  /** 姓名列 */
  nameCol: number
  /** 科目列 */
  subjectCols: SubjectCol[]
  /** 总分列，null 表示按科目求和 */
  totalCol: number | null
  /** 原表排名列（可选，仅作参考） */
  rankCol: number | null
}

export type ExamRole = 'base' | 'target'

export interface StudentRecord {
  id: string
  name: string
  scores: Record<string, number | null>
  total: number | null
  srcRank: number | null
}

export interface ExamData {
  role: ExamRole
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
  /** 分数段宽度，默认 50 */
  bucketSize: number
  /** 科目满分，用于图表与导出说明；空对象表示未设置 */
  fullMarks: Record<string, number>
  /** 及格线，用于统计及格人数；可选 */
  passMarks: Record<string, number>
}

export interface StudentAnalysis {
  key: string
  name: string
  inBase: boolean
  inTarget: boolean
  baseScores: Record<string, number | null>
  targetScores: Record<string, number | null>
  baseRanks: Record<string, number | null>
  targetRanks: Record<string, number | null>
  baseTotal: number | null
  targetTotal: number | null
  baseTotalRank: number | null
  targetTotalRank: number | null
  baseSrcRank: number | null
  targetSrcRank: number | null
  scoreDeltas: Record<string, number | null>
  rankDeltas: Record<string, number | null>
  totalDelta: number | null
  totalRankDelta: number | null
  upCount: number
  downCount: number
  note: string
}

export interface SubjectStat {
  subject: string
  fullMark: number | null
  passMark: number | null
  baseCount: number
  targetCount: number
  baseAvg: number | null
  targetAvg: number | null
  avgDelta: number | null
  baseMax: number | null
  targetMax: number | null
  baseMin: number | null
  targetMin: number | null
  up: number
  down: number
  flat: number
  basePassCount: number | null
  targetPassCount: number | null
}

export interface BucketStat {
  label: string
  base: number
  target: number
}

export interface AnalysisResult {
  baseLabel: string
  targetLabel: string
  baseFileName: string
  targetFileName: string
  subjects: string[]
  students: StudentAnalysis[]
  stats: SubjectStat[]
  totalStat: SubjectStat
  buckets: BucketStat[]
  counts: {
    baseCount: number
    targetCount: number
    comparable: number
    baseOnly: number
    targetOnly: number
    totalUp: number
    totalDown: number
    totalFlat: number
    subjectUp: number
    subjectDown: number
  }
  warnings: string[]
  options: AnalysisOptions
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
  role: ExamRole
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
  baseLabel: string
  targetLabel: string
  baseFileName: string
  targetFileName: string
  counts: AnalysisResult['counts']
  /** 解析后的考试数据（体积很小，用于一键恢复） */
  base: ExamData
  target: ExamData
  options: AnalysisOptions
}

