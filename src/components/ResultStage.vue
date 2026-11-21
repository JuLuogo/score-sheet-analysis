<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExportSelection, SeriesAnalysis, SeriesStudent } from '../types'
import ChartPanel from './ChartPanel.vue'
import { CHART_FONT } from '../lib/echarts'
import { deltaTone, deltaWord, fmtDelta, fmtRankDelta, fmtScore } from '../lib/format'

type Kind = 'text' | 'score' | 'rank' | 'delta' | 'scoreDelta' | 'num'
type SeriesRow = SeriesStudent & { index: number }
interface Col {
  key: string
  label: string
  width?: number
  minWidth?: number
  kind: Kind
  get: (row: SeriesRow) => unknown
}

const props = defineProps<{
  result: SeriesAnalysis
  view: 'rank' | 'trend' | 'bucket' | 'stats' | 'summary' | 'subject' | 'notes'
  className: string
  selection: ExportSelection
  exporting: boolean
  saved: boolean
}>()

const emit = defineEmits<{
  'update:className': [value: string]
  selection: [value: ExportSelection]
  exportXlsx: []
  exportCsv: []
  save: []
  back: []
  reset: []
}>()

const subject = ref(props.result.subjects[0] ?? '')
const query = ref('')
const dialogVisible = ref(false)

const first = computed(() => props.result.labels[0])
const last = computed(() => props.result.labels[props.result.labels.length - 1])

const avgRange = computed(() => {
  const values = props.result.examStats
    .flatMap((stat) => props.result.subjects.map((subject) => stat.subjectAvg[subject]))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = min === max ? 5 : Math.max(2, (max - min) * 0.2)
  return {
    min: Math.max(0, Math.floor(min - pad)),
    max: Math.ceil(max + pad),
  }
})

const avgOption = computed(() => ({
  color: ['#3b6ea5', '#c0504d', '#2e7d32', '#b7791f', '#7f7f7f', '#8c6d31', '#4f81bd'],
  textStyle: CHART_FONT,
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(255,255,255,.98)',
    borderColor: '#dddddd',
  },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: '#666666' } },
  grid: { left: 44, right: 16, top: 34, bottom: 24 },
  xAxis: {
    type: 'category',
    data: props.result.labels,
    boundaryGap: true,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e0e0e0' } },
    axisLabel: { color: '#666666', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    min: avgRange.value?.min,
    max: avgRange.value?.max,
    splitLine: { lineStyle: { color: '#eeeeee' } },
    axisLabel: { color: '#777777', fontSize: 11 },
  },
  series: props.result.subjects.map((item) => ({
    name: item,
    type: 'line',
    smooth: true,
    symbolSize: 6,
    data: props.result.examStats.map((stat) => stat.subjectAvg[item]),
    connectNulls: true,
    lineStyle: { width: 2 },
  })),
}))

const visibleBuckets = computed(() => {
  const list = props.result.buckets
  if (!list.length) return list
  const hasData = (bucket: (typeof list)[number]) => Boolean(bucket.first || bucket.last)
  const start = list.findIndex(hasData)
  if (start < 0) return []
  let end = start
  list.forEach((bucket, index) => {
    if (hasData(bucket)) end = index
  })
  return list.slice(start, end + 1)
})

const bucketOption = computed(() => ({
  color: ['#b7c4d4', '#3b6ea5'],
  textStyle: CHART_FONT,
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(255,255,255,.98)',
    borderColor: '#dddddd',
  },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: '#666666' } },
  grid: { left: 40, right: 14, top: 30, bottom: 22 },
  xAxis: {
    type: 'category',
    data: visibleBuckets.value.map((bucket) => bucket.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e0e0e0' } },
    axisLabel: { color: '#666666', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#eeeeee' } },
    axisLabel: { color: '#777777', fontSize: 10 },
  },
  series: [
    { name: first.value, type: 'bar', barMaxWidth: 20, data: visibleBuckets.value.map((b) => b.first), label: { show: true, position: 'top', fontSize: 9, color: '#666666' } },
    { name: last.value, type: 'bar', barMaxWidth: 20, data: visibleBuckets.value.map((b) => b.last), label: { show: true, position: 'top', fontSize: 9, color: '#3b6ea5' } },
  ],
}))

const TRAJECTORY_COLORS = [
  '#22d3ee',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#a78bfa',
  '#fb7185',
  '#38bdf8',
  '#4ade80',
  '#f59e0b',
]

const trajectoryStudents = computed(() =>
  props.result.students.filter((student) => student.totalRanks.some((rank) => rank != null)).slice(0, 6),
)

const bumpOption = computed(() => {
  const maxRank = Math.max(
    ...trajectoryStudents.value.flatMap((student) =>
      student.totalRanks.filter((rank): rank is number => rank != null),
    ),
    1,
  )
  const axisMax = Math.max(5, Math.ceil(maxRank / 5) * 5)
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: CHART_FONT.fontFamily, color: '#666666' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,.98)',
      borderColor: '#dddddd',
    },
    legend: {
      right: 4,
      top: 8,
      orient: 'vertical',
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: '#9fb6d4', fontSize: 11 },
    },
    grid: { left: 54, right: 132, top: 26, bottom: 34 },
    xAxis: {
      type: 'category',
      data: props.result.labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#666666' },
    },
    yAxis: {
      type: 'value',
      inverse: true,
      min: 1,
      max: axisMax,
      interval: axisMax <= 10 ? 1 : axisMax / 5,
      splitLine: { lineStyle: { color: '#eeeeee' } },
      axisLabel: { color: '#777777' },
    },
    series: trajectoryStudents.value.map((student, index) => ({
      name: student.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: student.totalRanks,
      connectNulls: false,
      lineStyle: { width: 2, color: TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length] },
      itemStyle: { color: TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length] },
      emphasis: { focus: 'series' },
    })),
  }
})

const rows = computed<SeriesRow[]>(() =>
  props.result.students.map((student, index) => ({ ...student, index: index + 1 })),
)
const filteredRows = computed(() => {
  const keyword = query.value.trim()
  if (!keyword) return rows.value
  return rows.value.filter((row) => row.name.includes(keyword))
})

const upTop = computed(() =>
  [...props.result.students]
    .filter((student) => (student.totalRankDelta ?? 0) > 0)
    .sort((a, b) => (b.totalRankDelta ?? 0) - (a.totalRankDelta ?? 0))
    .slice(0, 5),
)
const downTop = computed(() =>
  [...props.result.students]
    .filter((student) => (student.totalRankDelta ?? 0) < 0)
    .sort((a, b) => (a.totalRankDelta ?? 0) - (b.totalRankDelta ?? 0))
    .slice(0, 5),
)

const currentStat = computed(
  () => props.result.stats.find((item) => item.subject === subject.value) ?? props.result.stats[0],
)

const summaryColumns = computed<Col[]>(() => {
  const list: Col[] = [
    { key: 'index', label: '序号', width: 56, kind: 'num', get: (row) => row.index },
    { key: 'name', label: '姓名', width: 100, kind: 'text', get: (row) => row.name },
  ]
  props.result.labels.forEach((label, examIndex) => {
    list.push({
      key: `total-${examIndex}`,
      label: `${label}总分`,
      width: 96,
      kind: 'score',
      get: (row) => row.totals[examIndex],
    })
    list.push({
      key: `rank-${examIndex}`,
      label: `${label} 排名`,
      width: 72,
      kind: 'rank',
      get: (row) => row.totalRanks[examIndex],
    })
  })
  list.push(
    { key: 'totalDelta', label: '总分变化（首→末）', width: 118, kind: 'scoreDelta', get: (row) => row.totalDelta },
    { key: 'totalRankDelta', label: '排名变化', width: 90, kind: 'delta', get: (row) => row.totalRankDelta },
  )
  props.result.subjects.forEach((item) => {
    list.push({
      key: `subject-${item}`,
      label: `${item}名次`,
      width: 86,
      kind: 'delta',
      get: (row) => row.rankDeltas[item],
    })
  })
  list.push(
    { key: 'upCount', label: '上升科目', width: 78, kind: 'num', get: (row) => row.upCount },
    { key: 'downCount', label: '下降科目', width: 78, kind: 'num', get: (row) => row.downCount },
    { key: 'note', label: '备注', minWidth: 120, kind: 'text', get: (row) => row.note },
  )
  return list
})

const subjectColumns = computed<Col[]>(() => {
  const list: Col[] = [
    { key: 'index', label: '序号', width: 56, kind: 'num', get: (row) => row.index },
    { key: 'name', label: '姓名', width: 100, kind: 'text', get: (row) => row.name },
  ]
  props.result.labels.forEach((label, examIndex) => {
    list.push({
      key: `score-${examIndex}`,
      label: `${label} ${subject.value}`,
      width: 112,
      kind: 'score',
      get: (row) => row.scores[subject.value]?.[examIndex] ?? null,
    })
    list.push({
      key: `rank-${examIndex}`,
      label: `${label} 排名`,
      width: 84,
      kind: 'rank',
      get: (row) => row.ranks[subject.value]?.[examIndex] ?? null,
    })
  })
  list.push(
    { key: 'scoreDelta', label: '分数变化（首→末）', width: 118, kind: 'scoreDelta', get: (row) => row.scoreDeltas[subject.value] },
    { key: 'rankDelta', label: '排名变化', width: 90, kind: 'delta', get: (row) => row.rankDeltas[subject.value] },
    { key: 'word', label: '变动说明', minWidth: 120, kind: 'text', get: (row) => deltaWord(row.rankDeltas[subject.value]) },
    { key: 'note', label: '备注', minWidth: 110, kind: 'text', get: (row) => row.note },
  )
  return list
})

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const toneClass = (value: number | null | undefined) => `tone-${deltaTone(value)}`

const sortBy = (a: SeriesRow, b: SeriesRow, col: Col) => {
  const va = col.get(a)
  const vb = col.get(b)
  if (va == null && vb == null) return 0
  if (va == null) return 1
  if (vb == null) return -1
  if (typeof va === 'number' && typeof vb === 'number') return va - vb
  return String(va).localeCompare(String(vb), 'zh-CN')
}

const exportCount = computed(() => Object.values(props.selection).filter(Boolean).length)
const toggleExport = (key: keyof ExportSelection, value: boolean) => {
  emit('selection', { ...props.selection, [key]: value })
}

const printPage = () => window.print()
</script>

<template>
  <div class="result-view">
    <div class="view-header">
      <div class="view-title">
        <el-input
          :model-value="className"
          class="class-name-input"
          placeholder="班级名称（留空则导出为“分析”）"
          @update:model-value="(value: string) => emit('update:className', value)"
        />
        <span class="view-sub">
          {{ result.labels.join(' → ') }} · 全程参考 {{ result.counts.comparableAll }} 人
        </span>
      </div>
      <div class="view-actions">
        <el-button size="small" @click="emit('back')">返回场次</el-button>
        <el-button size="small" @click="dialogVisible = true">导出内容（{{ exportCount }}/5）</el-button>
        <el-button size="small" :loading="exporting" @click="emit('exportCsv')">CSV</el-button>
        <el-button size="small" :disabled="saved" @click="emit('save')">
          {{ saved ? '已存本机' : '存本机' }}
        </el-button>
        <el-button size="small" type="primary" :disabled="exportCount === 0" :loading="exporting" @click="emit('exportXlsx')">
          导出 Excel
        </el-button>
        <el-button size="small" @click="printPage">打印</el-button>
      </div>
    </div>

    <template v-if="view === 'rank'">
      <div class="view-grid rank-grid">
        <section class="card">
          <div class="card-head">
            <h3>总分排名迁移</h3>
            <span>Top {{ trajectoryStudents.length }} 学生 · 名次越靠上越好</span>
          </div>
          <ChartPanel key="rank-chart" :option="bumpOption" :height="470" />
        </section>
        <section class="card">
          <div class="card-head">
            <h3>名次升降</h3>
            <span>{{ first }} → {{ last }}</span>
          </div>
          <div class="list-block">
            <div class="list-title tone-up">进步 TOP5</div>
            <div v-for="(student, index) in upTop" :key="`up-${student.key}`" class="rank-row">
              <span class="rank-index">{{ index + 1 }}</span>
              <span class="rank-name">{{ student.name }}</span>
              <span class="rank-score">{{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}</span>
              <span class="rank-delta tone-up">{{ fmtRankDelta(student.totalRankDelta) }}</span>
            </div>
          </div>
          <div class="list-block">
            <div class="list-title tone-down">需关注 TOP5</div>
            <div v-for="(student, index) in downTop" :key="`down-${student.key}`" class="rank-row">
              <span class="rank-index">{{ index + 1 }}</span>
              <span class="rank-name">{{ student.name }}</span>
              <span class="rank-score">{{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}</span>
              <span class="rank-delta tone-down">{{ fmtRankDelta(student.totalRankDelta) }}</span>
            </div>
          </div>
        </section>
      </div>
    </template>

    <template v-else-if="view === 'trend'">
      <section class="card">
        <div class="card-head">
          <h3>各科平均分趋势</h3>
          <span>按场次顺序 · 纵轴按数据范围缩放</span>
        </div>
        <ChartPanel key="trend-chart" :option="avgOption" :height="430" />
      </section>
      <section class="card mt-16">
        <div class="card-head">
          <h3>各科均分明细</h3>
        </div>
        <table class="simple-table">
          <thead>
            <tr>
              <th>科目</th>
              <th v-for="label in result.labels" :key="label">{{ label }}</th>
              <th>首末变化</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in result.stats" :key="stat.subject">
              <td>{{ stat.subject }}</td>
              <td v-for="(label, index) in result.labels" :key="`${stat.subject}-${label}`">
                {{ fmtScore(result.examStats[index]?.subjectAvg[stat.subject]) }}
              </td>
              <td :class="toneClass(stat.avgDelta)">{{ fmtDelta(stat.avgDelta) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <template v-else-if="view === 'bucket'">
      <section class="card">
        <div class="card-head">
          <h3>总分分数段：首场 vs 末场</h3>
          <span>每 {{ result.options.bucketSize }} 分一段 · 仅显示有数据的区间</span>
        </div>
        <ChartPanel key="bucket-chart" :option="bucketOption" :height="470" />
      </section>
      <section class="card mt-16">
        <div class="card-head"><h3>分段人数</h3></div>
        <table class="simple-table">
          <thead>
            <tr>
              <th>分数段</th>
              <th>{{ first }}</th>
              <th>{{ last }}</th>
              <th>变化</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bucket in visibleBuckets" :key="bucket.label">
              <td>{{ bucket.label }}</td>
              <td>{{ bucket.first }}</td>
              <td>{{ bucket.last }}</td>
              <td :class="toneClass(bucket.last - bucket.first)">{{ bucket.last - bucket.first }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <template v-else-if="view === 'stats'">
      <section class="card">
        <div class="card-head">
          <h3>科目统计</h3>
          <span>{{ first }} → {{ last }}</span>
        </div>
        <el-table :data="[...result.stats, result.totalStat]" size="small" border>
          <el-table-column prop="subject" label="科目" width="100" />
          <el-table-column label="均分（首 → 末）" min-width="160">
            <template #default="{ row }">{{ fmtScore(row.firstAvg) }} → {{ fmtScore(row.lastAvg) }}</template>
          </el-table-column>
          <el-table-column label="变化" width="90">
            <template #default="{ row }"><span :class="toneClass(row.avgDelta)">{{ fmtDelta(row.avgDelta) }}</span></template>
          </el-table-column>
          <el-table-column label="最高（首 → 末）" min-width="150">
            <template #default="{ row }">{{ fmtScore(row.firstMax) }} → {{ fmtScore(row.lastMax) }}</template>
          </el-table-column>
          <el-table-column label="最低（首 → 末）" min-width="150">
            <template #default="{ row }">{{ fmtScore(row.firstMin) }} → {{ fmtScore(row.lastMin) }}</template>
          </el-table-column>
          <el-table-column label="名次↑" width="80">
            <template #default="{ row }"><span class="tone-up">{{ row.up }}</span></template>
          </el-table-column>
          <el-table-column label="名次↓" width="80">
            <template #default="{ row }"><span class="tone-down">{{ row.down }}</span></template>
          </el-table-column>
          <el-table-column prop="flat" label="持平" width="70" />
          <el-table-column label="及格人数" width="110">
            <template #default="{ row }">
              {{ row.passMark == null ? '—' : `${row.firstPassCount ?? '—'} → ${row.lastPassCount ?? '—'}` }}
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <template v-else-if="view === 'summary'">
      <section class="card">
        <div class="card-head">
          <h3>汇总矩阵</h3>
          <el-input v-model="query" placeholder="搜索姓名" clearable size="small" style="width: 180px" />
        </div>
        <el-table :data="filteredRows" size="small" border height="calc(100vh - 230px)">
          <el-table-column
            v-for="col in summaryColumns"
            :key="col.key"
            :prop="col.key"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            sortable
            :sort-method="(a: any, b: any) => sortBy(a, b, col)"
          >
            <template #default="{ row }">
              <span v-if="col.kind === 'delta'" :class="toneClass(asNumber(col.get(row)))">{{ fmtRankDelta(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'scoreDelta'" :class="toneClass(asNumber(col.get(row)))">{{ fmtDelta(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'score'">{{ fmtScore(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'rank'">{{ asNumber(col.get(row)) ?? '—' }}</span>
              <span v-else>{{ col.get(row) || '' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <template v-else-if="view === 'subject'">
      <section class="card">
        <div class="card-head">
          <h3>单科矩阵</h3>
          <el-radio-group v-model="subject" size="small">
            <el-radio-button v-for="item in result.subjects" :key="item" :value="item">{{ item }}</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="currentStat" class="subject-summary">
          当前科目：{{ subject }} · 均分 {{ fmtScore(currentStat.firstAvg) }} → {{ fmtScore(currentStat.lastAvg) }}
          <span :class="toneClass(currentStat.avgDelta)">{{ fmtDelta(currentStat.avgDelta) }}</span>
          · 名次上升 {{ currentStat.up }} / 下降 {{ currentStat.down }} / 持平 {{ currentStat.flat }}
        </div>
        <el-table :data="filteredRows" size="small" border height="calc(100vh - 270px)">
          <el-table-column
            v-for="col in subjectColumns"
            :key="col.key"
            :prop="col.key"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
            sortable
            :sort-method="(a: any, b: any) => sortBy(a, b, col)"
          >
            <template #default="{ row }">
              <span v-if="col.kind === 'delta'" :class="toneClass(asNumber(col.get(row)))">{{ fmtRankDelta(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'scoreDelta'" :class="toneClass(asNumber(col.get(row)))">{{ fmtDelta(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'score'">{{ fmtScore(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'rank'">{{ asNumber(col.get(row)) ?? '—' }}</span>
              <span v-else>{{ col.get(row) || '' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <template v-else>
      <div class="view-grid notes-grid">
        <section class="card">
          <div class="card-head"><h3>数据提醒</h3></div>
          <ul v-if="result.warnings.length" class="plain-list warning">
            <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
          </ul>
          <p v-else class="muted">没有发现明显的数据问题。</p>
        </section>
        <section class="card">
          <div class="card-head"><h3>口径说明</h3></div>
          <ul class="plain-list">
            <li>场次顺序：{{ result.labels.join(' → ') }}；第一场为基准。</li>
            <li>排名变化 = 首场名次 − 末场名次；分数变化 = 末场分数 − 首场分数。</li>
            <li>中间场次展示分数与排名，不单独计算变化。</li>
            <li>排名方式：{{ result.options.rankMode === 'competition' ? '并列名次（同分同名次、后续跳号）' : '顺序名次（同分按顺序编号）' }}。</li>
            <li>姓名按“姓名列”匹配；缺场学生对应位置为空。</li>
            <li>没有原表排名列也可以分析，名次由系统按分数自动计算。</li>
          </ul>
        </section>
      </div>
    </template>

    <el-dialog v-model="dialogVisible" title="导出内容" width="420px">
      <div class="export-dialog">
        <el-checkbox
          v-for="item in [
            { key: 'summary', label: '汇总总览' },
            { key: 'total', label: '总分明细' },
            { key: 'subjects', label: '各科分表' },
            { key: 'stats', label: '科目统计' },
            { key: 'notes', label: '说明页' },
          ]"
          :key="item.key"
          :model-value="selection[item.key as keyof ExportSelection]"
          @change="(value: boolean) => toggleExport(item.key as keyof ExportSelection, value)"
        >
          {{ item.label }}
        </el-checkbox>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="exportCount === 0" :loading="exporting" @click="dialogVisible = false; emit('exportXlsx')">
          导出 Excel
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>











