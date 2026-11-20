import type {
  AnalysisOptions,
  BucketRow,
  ExamData,
  SeriesAnalysis,
  SeriesExamStat,
  SeriesStudent,
  SeriesSubjectStat,
} from '../types'
import { average, round2 } from './format'

function rankMap(entries: { index: number; score: number }[], mode: AnalysisOptions['rankMode']): Record<number, number> {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.index - b.index)
  const result: Record<number, number> = {}
  if (mode === 'sequential') {
    sorted.forEach((entry, position) => {
      result[entry.index] = position + 1
    })
    return result
  }
  let previous: number | null = null
  let rank = 0
  sorted.forEach((entry, position) => {
    if (previous == null || Math.abs(entry.score - previous) > 1e-9) {
      rank = position + 1
      previous = entry.score
    }
    result[entry.index] = rank
  })
  return result
}

function examRanks(exam: ExamData, subjects: string[], mode: AnalysisOptions['rankMode']) {
  const subjectRanks: Record<string, Record<number, number>> = {}
  for (const subject of subjects) {
    const entries: { index: number; score: number }[] = []
    exam.students.forEach((student, index) => {
      const value = student.scores[subject]
      if (value != null) entries.push({ index, score: value })
    })
    subjectRanks[subject] = rankMap(entries, mode)
  }
  const totalEntries: { index: number; score: number }[] = []
  exam.students.forEach((student, index) => {
    if (student.total != null) totalEntries.push({ index, score: student.total })
  })
  const totalRanks = rankMap(totalEntries, mode)
  return { subjectRanks, totalRanks }
}

function positionsByName(exam: ExamData): Map<string, number[]> {
  const map = new Map<string, number[]>()
  exam.students.forEach((student, index) => {
    const list = map.get(student.name) ?? []
    list.push(index)
    map.set(student.name, list)
  })
  return map
}

function bucketize(values: (number | null)[], size: number): Map<string, number> {
  const map = new Map<string, number>()
  const clean = values.filter((value): value is number => value != null)
  const max = clean.length ? Math.max(...clean) : 0
  const upper = Math.max(size, Math.ceil((max + 1) / size) * size)
  for (let start = 0; start < upper; start += size) {
    map.set(`${start}-${start + size - 1}`, 0)
  }
  for (const value of clean) {
    const start = Math.min(Math.floor(value / size) * size, upper - size)
    const label = `${start}-${start + size - 1}`
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return map
}

function buildExamStat(exam: ExamData, subjects: string[]): SeriesExamStat {
  const totals = exam.students.map((student) => student.total).filter((value): value is number => value != null)
  const subjectAvg: Record<string, number | null> = {}
  for (const subject of subjects) {
    const avg = average(exam.students.map((student) => student.scores[subject]))
    subjectAvg[subject] = avg == null ? null : round2(avg)
  }
  return {
    label: exam.label,
    count: exam.students.length,
    totalAvg: totals.length ? round2(totals.reduce((sum, value) => sum + value, 0) / totals.length) : null,
    totalMax: totals.length ? Math.max(...totals) : null,
    totalMin: totals.length ? Math.min(...totals) : null,
    subjectAvg,
  }
}

function buildSubjectStat(
  subject: string,
  students: SeriesStudent[],
  options: AnalysisOptions,
): SeriesSubjectStat {
  const firstScores = students.map((student) => student.scores[subject]?.[0] ?? null)
  const lastIndex = students[0]?.scores[subject]?.length ? students[0].scores[subject].length - 1 : 0
  const lastScores = students.map((student) => student.scores[subject]?.[lastIndex] ?? null)
  const firstClean = firstScores.filter((value): value is number => value != null)
  const lastClean = lastScores.filter((value): value is number => value != null)
  const firstAvg = average(firstScores)
  const lastAvg = average(lastScores)
  const passMark = options.passMarks[subject] ?? null
  const up = students.filter((student) => {
    const delta = student.rankDeltas[subject]
    return delta != null && delta > 0
  }).length
  const down = students.filter((student) => {
    const delta = student.rankDeltas[subject]
    return delta != null && delta < 0
  }).length
  const flat = students.filter((student) => student.rankDeltas[subject] === 0).length
  return {
    subject,
    fullMark: options.fullMarks[subject] ?? null,
    passMark,
    firstAvg: firstAvg == null ? null : round2(firstAvg),
    lastAvg: lastAvg == null ? null : round2(lastAvg),
    avgDelta: firstAvg == null || lastAvg == null ? null : round2(lastAvg - firstAvg),
    firstMax: firstClean.length ? Math.max(...firstClean) : null,
    lastMax: lastClean.length ? Math.max(...lastClean) : null,
    firstMin: firstClean.length ? Math.min(...firstClean) : null,
    lastMin: lastClean.length ? Math.min(...lastClean) : null,
    up,
    down,
    flat,
    firstPassCount: passMark == null ? null : firstClean.filter((value) => value >= passMark).length,
    lastPassCount: passMark == null ? null : lastClean.filter((value) => value >= passMark).length,
  }
}

function buildTotalStat(students: SeriesStudent[], options: AnalysisOptions): SeriesSubjectStat {
  const last = students[0]?.totals?.length ? students[0].totals.length - 1 : 0
  const firstClean = students.map((s) => s.totals[0]).filter((v): v is number => v != null)
  const lastClean = students.map((s) => s.totals[last]).filter((v): v is number => v != null)
  const firstAvg = average(students.map((s) => s.totals[0]))
  const lastAvg = average(students.map((s) => s.totals[last]))
  return {
    subject: '总分',
    fullMark: options.fullMarks['总分'] ?? null,
    passMark: null,
    firstAvg: firstAvg == null ? null : round2(firstAvg),
    lastAvg: lastAvg == null ? null : round2(lastAvg),
    avgDelta: firstAvg == null || lastAvg == null ? null : round2(lastAvg - firstAvg),
    firstMax: firstClean.length ? Math.max(...firstClean) : null,
    lastMax: lastClean.length ? Math.max(...lastClean) : null,
    firstMin: firstClean.length ? Math.min(...firstClean) : null,
    lastMin: lastClean.length ? Math.min(...lastClean) : null,
    up: students.filter((s) => s.totalRankDelta != null && s.totalRankDelta > 0).length,
    down: students.filter((s) => s.totalRankDelta != null && s.totalRankDelta < 0).length,
    flat: students.filter((s) => s.totalRankDelta === 0).length,
    firstPassCount: null,
    lastPassCount: null,
  }
}

/** 多场考试横向对比：名次与分数变化均以“第一场（基准）”为参照 */
export function analyzeSeries(exams: ExamData[], options: AnalysisOptions): SeriesAnalysis {
  if (exams.length < 2) throw new Error('至少选择 2 场考试才能对比')
  const labels = exams.map((exam) => exam.label)
  const lastIndex = exams.length - 1

  const subjects: string[] = []
  for (const exam of exams) {
    for (const subject of exam.subjects) {
      if (!subjects.includes(subject)) subjects.push(subject)
    }
  }

  const rankInfo = exams.map((exam) => examRanks(exam, subjects, options.rankMode))
  const positions = exams.map((exam) => positionsByName(exam))
  const studentMaps = exams.map((exam) => exam.students)

  const keys: string[] = []
  const nameOrder: string[] = []
  for (const exam of exams) {
    for (const student of exam.students) {
      if (!nameOrder.includes(student.name)) nameOrder.push(student.name)
    }
  }

  for (const name of nameOrder) {
    let maxCount = 0
    for (const map of positions) maxCount = Math.max(maxCount, map.get(name)?.length ?? 0)
    for (let k = 0; k < maxCount; k += 1) keys.push(`${name}#${k}`)
  }

  const students: SeriesStudent[] = []
  for (const key of keys) {
    const [name, rawIndex] = key.split('#')
    const occurrence = Number(rawIndex)
    const scores: Record<string, (number | null)[]> = {}
    const ranks: Record<string, (number | null)[]> = {}
    const totals: (number | null)[] = []
    const totalRanks: (number | null)[] = []
    const inExam: boolean[] = []

    subjects.forEach((subject) => {
      scores[subject] = []
      ranks[subject] = []
    })

    exams.forEach((_, examIndex) => {
      const index = positions[examIndex].get(name)?.[occurrence]
      if (index == null) {
        subjects.forEach((subject) => {
          scores[subject].push(null)
          ranks[subject].push(null)
        })
        totals.push(null)
        totalRanks.push(null)
        inExam.push(false)
        return
      }
      const student = studentMaps[examIndex][index]
      subjects.forEach((subject) => {
        const value = student.scores[subject] ?? null
        scores[subject].push(value)
        ranks[subject].push(value == null ? null : rankInfo[examIndex].subjectRanks[subject]?.[index] ?? null)
      })
      totals.push(student.total)
      totalRanks.push(student.total == null ? null : rankInfo[examIndex].totalRanks[index] ?? null)
      inExam.push(true)
    })

    const scoreDeltas: Record<string, number | null> = {}
    const rankDeltas: Record<string, number | null> = {}
    let upCount = 0
    let downCount = 0
    for (const subject of subjects) {
      const first = scores[subject][0]
      const last = scores[subject][lastIndex]
      scoreDeltas[subject] = first == null || last == null ? null : round2(last - first)
      const firstRank = ranks[subject][0]
      const lastRank = ranks[subject][lastIndex]
      const delta = firstRank == null || lastRank == null ? null : firstRank - lastRank
      rankDeltas[subject] = delta
      if (delta != null && delta > 0) upCount += 1
      if (delta != null && delta < 0) downCount += 1
    }

    const totalDelta =
      totals[0] == null || totals[lastIndex] == null ? null : round2((totals[lastIndex] as number) - (totals[0] as number))
    const totalRankDelta =
      totalRanks[0] == null || totalRanks[lastIndex] == null
        ? null
        : (totalRanks[0] as number) - (totalRanks[lastIndex] as number)

    const presentCount = inExam.filter(Boolean).length
    const note =
      presentCount === exams.length
        ? ''
        : inExam[0] && !inExam[lastIndex]
          ? '最后一堂未参考'
          : !inExam[0] && inExam[lastIndex]
            ? '第一堂未参考'
            : `仅 ${presentCount} 场有成绩`

    students.push({
      key,
      name: occurrence === 0 ? name : `${name}(${occurrence + 1})`,
      scores,
      ranks,
      totals,
      totalRanks,
      inExam,
      totalDelta,
      totalRankDelta,
      scoreDeltas,
      rankDeltas,
      upCount,
      downCount,
      note,
    })
  }

  students.sort((a, b) => {
    const ta = a.totalRanks[lastIndex] ?? Number.MAX_SAFE_INTEGER
    const tb = b.totalRanks[lastIndex] ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    const fa = a.totalRanks[0] ?? Number.MAX_SAFE_INTEGER
    const fb = b.totalRanks[0] ?? Number.MAX_SAFE_INTEGER
    if (fa !== fb) return fa - fb
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  const stats = subjects.map((subject) => buildSubjectStat(subject, students, options))
  const totalStat = buildTotalStat(students, options)
  const examStats = exams.map((exam) => buildExamStat(exam, subjects))

  const firstBuckets = bucketize(
    exams[0].students.map((student) => student.total),
    options.bucketSize,
  )
  const lastBuckets = bucketize(
    exams[lastIndex].students.map((student) => student.total),
    options.bucketSize,
  )
  const bucketLabels = [...new Set([...firstBuckets.keys(), ...lastBuckets.keys()])].sort((a, b) => {
    return Number(a.split('-')[0]) - Number(b.split('-')[0])
  })
  const buckets: BucketRow[] = bucketLabels.map((label) => ({
    label,
    first: firstBuckets.get(label) ?? 0,
    last: lastBuckets.get(label) ?? 0,
  }))

  const comparableAll = students.filter((student) => student.inExam.every(Boolean)).length
  const firstOnly = students.filter((student) => student.inExam[0] && student.inExam.filter(Boolean).length === 1).length
  const lastOnly = students.filter(
    (student) => student.inExam[lastIndex] && student.inExam.filter(Boolean).length === 1,
  ).length

  return {
    labels,
    fileName: exams.map((exam) => exam.fileName).join(' / '),
    subjects,
    students,
    examStats,
    stats,
    totalStat,
    buckets,
    counts: {
      examCounts: exams.map((exam) => exam.students.length),
      comparableAll,
      firstOnly,
      lastOnly,
      totalUp: totalStat.up,
      totalDown: totalStat.down,
      totalFlat: totalStat.flat,
      subjectUp: students.reduce((sum, student) => sum + student.upCount, 0),
      subjectDown: students.reduce((sum, student) => sum + student.downCount, 0),
    },
    warnings: [...new Set(exams.flatMap((exam) => exam.warnings))],
    options,
  }
}

