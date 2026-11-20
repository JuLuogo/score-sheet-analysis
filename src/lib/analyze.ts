import type {
  AnalysisOptions,
  AnalysisResult,
  BucketStat,
  ExamData,
  StudentAnalysis,
  StudentRecord,
  SubjectStat,
} from '../types'
import { average, round2 } from './format'

interface RankEntry {
  key: string
  score: number
}

function rankMap(entries: RankEntry[], mode: AnalysisOptions['rankMode']): Record<string, number> {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
  const result: Record<string, number> = {}
  if (mode === 'sequential') {
    sorted.forEach((entry, index) => {
      result[entry.key] = index + 1
    })
    return result
  }
  let previous: number | null = null
  let rank = 0
  sorted.forEach((entry, index) => {
    if (previous == null || Math.abs(entry.score - previous) > 1e-9) {
      rank = index + 1
      previous = entry.score
    }
    result[entry.key] = rank
  })
  return result
}

function buildRanks(exam: ExamData, subjects: string[], mode: AnalysisOptions['rankMode']) {
  const ranks: Record<string, Record<string, number>> = {}
  for (const subject of subjects) {
    const entries: RankEntry[] = []
    exam.students.forEach((student, index) => {
      const score = student.scores[subject]
      if (score != null) entries.push({ key: `${index}`, score })
    })
    ranks[subject] = rankMap(entries, mode)
  }
  const totalEntries: RankEntry[] = []
  exam.students.forEach((student, index) => {
    if (student.total != null) totalEntries.push({ key: `${index}`, score: student.total })
  })
  ranks['总分'] = rankMap(totalEntries, mode)
  return ranks
}

function bucketize(values: (number | null)[], size: number): Map<string, number> {
  const map = new Map<string, number>()
  const clean = values.filter((v): v is number => v != null)
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

function makeStat(
  subject: string,
  base: StudentRecord[],
  target: StudentRecord[],
  deltas: (number | null)[],
  options: AnalysisOptions,
): SubjectStat {
  const baseValues = base.map((s) => (subject === '总分' ? s.total : s.scores[subject]))
  const targetValues = target.map((s) => (subject === '总分' ? s.total : s.scores[subject]))
  const fullMark = options.fullMarks[subject] ?? null
  const passMark = options.passMarks[subject] ?? null
  const up = deltas.filter((d) => d != null && d > 0).length
  const down = deltas.filter((d) => d != null && d < 0).length
  const flat = deltas.filter((d) => d === 0).length
  const baseAvg = average(baseValues)
  const targetAvg = average(targetValues)
  return {
    subject,
    fullMark,
    passMark,
    baseCount: baseValues.filter((v) => v != null).length,
    targetCount: targetValues.filter((v) => v != null).length,
    baseAvg: baseAvg == null ? null : round2(baseAvg),
    targetAvg: targetAvg == null ? null : round2(targetAvg),
    avgDelta: baseAvg == null || targetAvg == null ? null : round2(targetAvg - baseAvg),
    baseMax: baseValues.filter((v): v is number => v != null).length
      ? Math.max(...baseValues.filter((v): v is number => v != null))
      : null,
    targetMax: targetValues.filter((v): v is number => v != null).length
      ? Math.max(...targetValues.filter((v): v is number => v != null))
      : null,
    baseMin: baseValues.filter((v): v is number => v != null).length
      ? Math.min(...baseValues.filter((v): v is number => v != null))
      : null,
    targetMin: targetValues.filter((v): v is number => v != null).length
      ? Math.min(...targetValues.filter((v): v is number => v != null))
      : null,
    up,
    down,
    flat,
    basePassCount:
      passMark == null ? null : baseValues.filter((v) => v != null && v >= passMark).length,
    targetPassCount:
      passMark == null ? null : targetValues.filter((v) => v != null && v >= passMark).length,
  }
}

/** 对比两场考试，计算每个学生、每个科目的排名与分数变化 */
export function analyze(base: ExamData, target: ExamData, options: AnalysisOptions): AnalysisResult {
  const subjects: string[] = []
  for (const subject of [...base.subjects, ...target.subjects]) {
    if (!subjects.includes(subject)) subjects.push(subject)
  }

  const baseRanks = buildRanks(base, subjects, options.rankMode)
  const targetRanks = buildRanks(target, subjects, options.rankMode)

  const group = (exam: ExamData) => {
    const map = new Map<string, { student: StudentRecord; index: number }[]>()
    exam.students.forEach((student, index) => {
      const list = map.get(student.name) ?? []
      list.push({ student, index })
      map.set(student.name, list)
    })
    return map
  }
  const baseGroups = group(base)
  const targetGroups = group(target)

  const names: string[] = []
  base.students.forEach((student) => {
    if (!names.includes(student.name)) names.push(student.name)
  })
  target.students.forEach((student) => {
    if (!names.includes(student.name)) names.push(student.name)
  })

  const students: StudentAnalysis[] = []
  let comparable = 0
  let baseOnly = 0
  let targetOnly = 0
  let totalUp = 0
  let totalDown = 0
  let totalFlat = 0
  let subjectUp = 0
  let subjectDown = 0

  for (const name of names) {
    const baseList = baseGroups.get(name) ?? []
    const targetList = targetGroups.get(name) ?? []
    const size = Math.max(baseList.length, targetList.length)
    for (let k = 0; k < size; k += 1) {
      const baseItem = baseList[k]
      const targetItem = targetList[k]
      const baseStudent = baseItem?.student ?? null
      const targetStudent = targetItem?.student ?? null
      if (!baseStudent && !targetStudent) continue
      if (baseStudent && !targetStudent) baseOnly += 1
      if (!baseStudent && targetStudent) targetOnly += 1
      if (baseStudent && targetStudent) comparable += 1

      const baseScores: Record<string, number | null> = {}
      const targetScores: Record<string, number | null> = {}
      const baseSubjectRanks: Record<string, number | null> = {}
      const targetSubjectRanks: Record<string, number | null> = {}
      const scoreDeltas: Record<string, number | null> = {}
      const rankDeltas: Record<string, number | null> = {}
      let upCount = 0
      let downCount = 0

      for (const subject of subjects) {
        const baseScore = baseStudent ? baseStudent.scores[subject] ?? null : null
        const targetScore = targetStudent ? targetStudent.scores[subject] ?? null : null
        baseScores[subject] = baseScore
        targetScores[subject] = targetScore
        const baseRank = baseStudent && baseScore != null ? baseRanks[subject][`${baseItem.index}`] ?? null : null
        const targetRank =
          targetStudent && targetScore != null ? targetRanks[subject][`${targetItem.index}`] ?? null : null
        baseSubjectRanks[subject] = baseRank
        targetSubjectRanks[subject] = targetRank
        scoreDeltas[subject] =
          baseScore == null || targetScore == null ? null : round2(targetScore - baseScore)
        const rankDelta = baseRank == null || targetRank == null ? null : baseRank - targetRank
        rankDeltas[subject] = rankDelta
        if (rankDelta != null) {
          if (rankDelta > 0) {
            upCount += 1
            subjectUp += 1
          } else if (rankDelta < 0) {
            downCount += 1
            subjectDown += 1
          }
        }
      }

      const baseTotalRank =
        baseStudent && baseStudent.total != null ? baseRanks['总分'][`${baseItem.index}`] ?? null : null
      const targetTotalRank =
        targetStudent && targetStudent.total != null
          ? targetRanks['总分'][`${targetItem.index}`] ?? null
          : null
      const totalDelta =
        baseStudent?.total == null || targetStudent?.total == null
          ? null
          : round2(targetStudent.total - baseStudent.total)
      const totalRankDelta =
        baseTotalRank == null || targetTotalRank == null ? null : baseTotalRank - targetTotalRank
      if (totalRankDelta != null) {
        if (totalRankDelta > 0) totalUp += 1
        else if (totalRankDelta < 0) totalDown += 1
        else totalFlat += 1
      }

      const note = !baseStudent ? '仅对比考试有成绩' : !targetStudent ? '仅基准考试有成绩' : ''
      students.push({
        key: `${name}#${k}`,
        name: size > 1 ? `${name}(${k + 1})` : name,
        inBase: Boolean(baseStudent),
        inTarget: Boolean(targetStudent),
        baseScores,
        targetScores,
        baseRanks: baseSubjectRanks,
        targetRanks: targetSubjectRanks,
        baseTotal: baseStudent?.total ?? null,
        targetTotal: targetStudent?.total ?? null,
        baseTotalRank,
        targetTotalRank,
        baseSrcRank: baseStudent?.srcRank ?? null,
        targetSrcRank: targetStudent?.srcRank ?? null,
        scoreDeltas,
        rankDeltas,
        totalDelta,
        totalRankDelta,
        upCount,
        downCount,
        note,
      })
    }
  }

  students.sort((a, b) => {
    const ta = a.targetTotalRank ?? Number.MAX_SAFE_INTEGER
    const tb = b.targetTotalRank ?? Number.MAX_SAFE_INTEGER
    if (ta !== tb) return ta - tb
    const ba = a.baseTotalRank ?? Number.MAX_SAFE_INTEGER
    const bb = b.baseTotalRank ?? Number.MAX_SAFE_INTEGER
    if (ba !== bb) return ba - bb
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  const stats = subjects.map((subject) =>
    makeStat(
      subject,
      base.students,
      target.students,
      students.map((s) => s.rankDeltas[subject] ?? null),
      options,
    ),
  )
  const totalStat = makeStat(
    '总分',
    base.students,
    target.students,
    students.map((s) => s.totalRankDelta),
    options,
  )

  const baseTotalValues = base.students.map((s) => s.total)
  const targetTotalValues = target.students.map((s) => s.total)
  const baseBuckets = bucketize(baseTotalValues, options.bucketSize)
  const targetBuckets = bucketize(targetTotalValues, options.bucketSize)
  const labels = [...new Set([...baseBuckets.keys(), ...targetBuckets.keys()])].sort((a, b) => {
    const na = Number(a.split('-')[0])
    const nb = Number(b.split('-')[0])
    return na - nb
  })
  const buckets: BucketStat[] = labels.map((label) => ({
    label,
    base: baseBuckets.get(label) ?? 0,
    target: targetBuckets.get(label) ?? 0,
  }))

  return {
    baseLabel: base.label,
    targetLabel: target.label,
    baseFileName: base.fileName,
    targetFileName: target.fileName,
    subjects,
    students,
    stats,
    totalStat,
    buckets,
    counts: {
      baseCount: base.students.length,
      targetCount: target.students.length,
      comparable,
      baseOnly,
      targetOnly,
      totalUp,
      totalDown,
      totalFlat,
      subjectUp,
      subjectDown,
    },
    warnings: [...new Set([...base.warnings, ...target.warnings])],
    options,
  }
}
