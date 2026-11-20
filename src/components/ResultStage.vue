<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExportSelection, SeriesAnalysis, SeriesStudent } from '../types'
import ChartPanel from './ChartPanel.vue'
import { CHART_COLORS, CHART_FONT } from '../lib/echarts'
import { deltaTone, deltaWord, fmtDelta, fmtRankDelta, fmtScore } from '../lib/format'

type TabKey = 'overview' | 'summary' | 'subject' | 'notes'
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

const initialTab =
  new URLSearchParams(window.location.search).get('tab')
const tab = ref<TabKey>(
  initialTab === 'summary' || initialTab === 'subject' || initialTab === 'notes'
    ? initialTab
    : 'overview',
)
const subject = ref(props.result.subjects[0] ?? '')
const query = ref('')
const dialogVisible = ref(false)

const first = computed(() => props.result.labels[0])
const last = computed(() => props.result.labels[props.result.labels.length - 1])

const avgOption = computed(() => ({
  color: ['#1f3864', '#2f5597', '#70ad47', '#c55a11', '#8ea9db', '#a5a5a5', '#c0504d'],
  textStyle: CHART_FONT,
  tooltip: { trigger: 'axis' },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
  grid: { left: 42, right: 16, top: 44, bottom: 30 },
  xAxis: {
    type: 'category',
    data: props.result.labels,
    boundaryGap: false,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#d9dee7' } },
    axisLabel: { color: '#595959' },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#eef1f6' } },
    axisLabel: { color: '#8c8c8c' },
  },
  series: props.result.subjects.map((item) => ({
    name: item,
    type: 'line',
    smooth: true,
    symbolSize: 6,
    data: props.result.examStats.map((stat) => stat.subjectAvg[item]),
  })),
}))

const rankOption = computed(() => {
  const labels = [...props.result.subjects, '总分']
  const stats = [...props.result.stats, props.result.totalStat]
  return {
    color: [CHART_COLORS.up, CHART_COLORS.flat, CHART_COLORS.down],
    textStyle: CHART_FONT,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    grid: { left: 42, right: 16, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d9dee7' } },
      axisLabel: { color: '#595959' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#eef1f6' } },
      axisLabel: { color: '#8c8c8c' },
    },
    series: [
      { name: '名次上升', type: 'bar', stack: 'total', barMaxWidth: 32, data: stats.map((item) => item.up), label: { show: true, fontSize: 10, color: '#fff' } },
      { name: '持平', type: 'bar', stack: 'total', barMaxWidth: 32, data: stats.map((item) => item.flat), label: { show: true, fontSize: 10, color: '#595959' } },
      { name: '名次下降', type: 'bar', stack: 'total', barMaxWidth: 32, data: stats.map((item) => item.down), label: { show: true, fontSize: 10, color: '#fff' } },
    ],
  }
})

const bucketOption = computed(() => ({
  color: [CHART_COLORS.base, CHART_COLORS.target],
  textStyle: CHART_FONT,
  tooltip: { trigger: 'axis' },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
  grid: { left: 42, right: 16, top: 40, bottom: 30 },
  xAxis: {
    type: 'category',
    data: props.result.buckets.map((bucket) => bucket.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#d9dee7' } },
    axisLabel: { color: '#595959', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#eef1f6' } },
    axisLabel: { color: '#8c8c8c' },
  },
  series: [
    { name: first.value, type: 'bar', barMaxWidth: 24, data: props.result.buckets.map((b) => b.first), label: { show: true, position: 'top', fontSize: 10, color: '#6b7280' } },
    { name: last.value, type: 'bar', barMaxWidth: 24, data: props.result.buckets.map((b) => b.last), label: { show: true, position: 'top', fontSize: 10, color: '#1f3864' } },
  ],
}))

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
    .filter((student) => student.totalRankDelta != null)
    .sort((a, b) => (b.totalRankDelta ?? 0) - (a.totalRankDelta ?? 0))
    .slice(0, 5),
)
const downTop = computed(() =>
  [...props.result.students]
    .filter((student) => student.totalRankDelta != null)
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
      label: '排名',
      width: 64,
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
      label: `${label}分数`,
      width: 96,
      kind: 'score',
      get: (row) => row.scores[subject.value]?.[examIndex] ?? null,
    })
    list.push({
      key: `rank-${examIndex}`,
      label: '排名',
      width: 64,
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

const maxBy = (list: SeriesAnalysis['stats'], key: (item: SeriesAnalysis['stats'][number]) => number) =>
  list.length ? list.reduce((best, item) => (key(item) > key(best) ? item : best), list[0]) : null
const minBy = (list: SeriesAnalysis['stats'], key: (item: SeriesAnalysis['stats'][number]) => number) =>
  list.length ? list.reduce((best, item) => (key(item) < key(best) ? item : best), list[0]) : null

const printPage = () => window.print()

const topGain = computed(() => maxBy(props.result.stats, (item) => item.avgDelta ?? -999))
const topLoss = computed(() => minBy(props.result.stats, (item) => item.avgDelta ?? 999))
</script>

<template>
  <div class="stage result-stage">
    <div class="result-head no-print">
      <div>
        <div class="result-title-row">
          <el-input
            :model-value="className"
            class="class-name-input"
            size="large"
            @update:model-value="(value: string) => emit('update:className', value)"
          />
          <span class="result-sub">
            {{ result.labels.join(' → ') }} · 全程参考 {{ result.counts.comparableAll }} 人
          </span>
        </div>
      </div>
      <div class="result-actions">
        <el-button @click="emit('back')">返回场次</el-button>
        <el-button @click="dialogVisible = true">导出内容（{{ exportCount }}/5）</el-button>
        <el-button :loading="exporting" @click="emit('exportCsv')">CSV</el-button>
        <el-button :type="saved ? 'success' : 'default'" :disabled="saved" @click="emit('save')">
          {{ saved ? '已存本机' : '存本机' }}
        </el-button>
        <el-button type="primary" :loading="exporting" @click="emit('exportXlsx')">导出 Excel</el-button>
        <el-button @click="printPage">打印</el-button>
      </div>
    </div>

    <el-row :gutter="12" class="kpi-row">
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">考试场次</span>
          <strong class="kpi-value">{{ result.labels.length }} 场</strong>
          <span class="kpi-sub">{{ result.labels.join(' / ') }}</span>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">总分均分</span>
          <strong class="kpi-value" :class="toneClass(result.totalStat.avgDelta)">
            {{ fmtScore(result.totalStat.lastAvg) }}
          </strong>
          <span class="kpi-sub">
            {{ first }} {{ fmtScore(result.totalStat.firstAvg) }} · {{ fmtDelta(result.totalStat.avgDelta) }}
          </span>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">最高分</span>
          <strong class="kpi-value">{{ fmtScore(result.totalStat.lastMax) }}</strong>
          <span class="kpi-sub">{{ first }} {{ fmtScore(result.totalStat.firstMax) }}</span>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">总分名次</span>
          <strong class="kpi-value">↑{{ result.counts.totalUp }} / ↓{{ result.counts.totalDown }}</strong>
          <span class="kpi-sub">持平 {{ result.counts.totalFlat }} 人（{{ first }}→{{ last }}）</span>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">单科名次变化</span>
          <strong class="kpi-value">↑{{ result.counts.subjectUp }} / ↓{{ result.counts.subjectDown }}</strong>
          <span class="kpi-sub">{{ result.students.length }} 人 × {{ result.subjects.length }} 科</span>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :lg="4">
        <el-card shadow="never" class="kpi">
          <span class="kpi-label">全程参考</span>
          <strong class="kpi-value">{{ result.counts.comparableAll }} 人</strong>
          <span class="kpi-sub">仅首场 {{ result.counts.firstOnly }} · 仅末场 {{ result.counts.lastOnly }}</span>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="tab" class="result-tabs no-print">
      <el-tab-pane label="总览" name="overview" />
      <el-tab-pane label="汇总矩阵" name="summary" />
      <el-tab-pane label="单科矩阵" name="subject" />
      <el-tab-pane name="notes">
        <template #label>
          数据说明
          <el-badge v-if="result.warnings.length" :value="result.warnings.length" type="warning" />
        </template>
      </el-tab-pane>
    </el-tabs>

    <div v-show="tab === 'overview'" class="tab-panel">
      <el-row :gutter="12" class="insight-row">
        <el-col :xs="24" :sm="12" :lg="6">
          <el-card shadow="never" class="insight">
            <span>增分最多</span>
            <strong>{{ topGain ? `${topGain.subject} ${fmtDelta(topGain.avgDelta)}` : '—' }}</strong>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :lg="6">
          <el-card shadow="never" class="insight">
            <span>下滑最多</span>
            <strong>{{ topLoss ? `${topLoss.subject} ${fmtDelta(topLoss.avgDelta)}` : '—' }}</strong>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :lg="6">
          <el-card shadow="never" class="insight">
            <span>进步最大</span>
            <strong>{{ upTop[0] ? `${upTop[0].name} ${fmtRankDelta(upTop[0].totalRankDelta)}` : '—' }}</strong>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :lg="6">
          <el-card shadow="never" class="insight">
            <span>与基准差距</span>
            <strong>{{ first }} → {{ last }}：总分均分 {{ fmtDelta(result.totalStat.avgDelta) }}</strong>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="14">
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-panel">
            <template #header>
              <div class="card-head">
                <strong>各科均分趋势</strong>
                <span class="muted small">按场次顺序</span>
              </div>
            </template>
            <ChartPanel :option="avgOption" :height="300" />
          </el-card>
        </el-col>
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="chart-panel">
            <template #header>
              <div class="card-head">
                <strong>名次升降人数（{{ first }} → {{ last }}）</strong>
                <span class="muted small">按“人×科”统计</span>
              </div>
            </template>
            <ChartPanel :option="rankOption" :height="300" />
          </el-card>
        </el-col>
        <el-col :span="24">
          <el-card shadow="never" class="chart-panel mt-8">
            <template #header>
              <div class="card-head">
                <strong>总分分数段：首场 vs 末场</strong>
                <span class="muted small">每 {{ result.options.bucketSize }} 分一段</span>
              </div>
            </template>
            <ChartPanel :option="bucketOption" :height="280" />
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="14" class="mt-16">
        <el-col :xs="24" :md="12">
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <strong>总分名次上升 TOP5（{{ first }} → {{ last }}）</strong>
              </div>
            </template>
            <div v-for="(student, index) in upTop" :key="student.key" class="mover-item">
              <span class="mover-index">{{ index + 1 }}</span>
              <span class="mover-name">{{ student.name }}</span>
              <span class="mover-score">
                {{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}
              </span>
              <span class="mover-delta tone-up">{{ fmtRankDelta(student.totalRankDelta) }}</span>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <strong>总分名次下降 TOP5（{{ first }} → {{ last }}）</strong>
              </div>
            </template>
            <div v-for="(student, index) in downTop" :key="student.key" class="mover-item">
              <span class="mover-index">{{ index + 1 }}</span>
              <span class="mover-name">{{ student.name }}</span>
              <span class="mover-score">
                {{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}
              </span>
              <span class="mover-delta tone-down">{{ fmtRankDelta(student.totalRankDelta) }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="mt-16">
        <template #header>
          <div class="card-head">
            <strong>科目统计（{{ first }} → {{ last }}）</strong>
          </div>
        </template>
        <el-table :data="[...result.stats, result.totalStat]" size="small" border>
          <el-table-column prop="subject" label="科目" width="100" />
          <el-table-column label="均分（首 → 末）">
            <template #default="{ row }">{{ fmtScore(row.firstAvg) }} → {{ fmtScore(row.lastAvg) }}</template>
          </el-table-column>
          <el-table-column label="变化" width="90">
            <template #default="{ row }">
              <span :class="toneClass(row.avgDelta)">{{ fmtDelta(row.avgDelta) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="最高（首 → 末）">
            <template #default="{ row }">{{ fmtScore(row.firstMax) }} → {{ fmtScore(row.lastMax) }}</template>
          </el-table-column>
          <el-table-column label="最低（首 → 末）">
            <template #default="{ row }">{{ fmtScore(row.firstMin) }} → {{ fmtScore(row.lastMin) }}</template>
          </el-table-column>
          <el-table-column label="名次↑" width="72">
            <template #default="{ row }"><span class="tone-up">{{ row.up }}</span></template>
          </el-table-column>
          <el-table-column label="名次↓" width="72">
            <template #default="{ row }"><span class="tone-down">{{ row.down }}</span></template>
          </el-table-column>
          <el-table-column prop="flat" label="持平" width="64" />
          <el-table-column label="及格人数" width="110">
            <template #default="{ row }">
              {{ row.passMark == null ? '—' : `${row.firstPassCount ?? '—'} → ${row.lastPassCount ?? '—'}` }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <div v-show="tab === 'summary'" class="tab-panel">
      <el-card shadow="never">
        <template #header>
          <div class="card-head">
            <strong>汇总矩阵</strong>
            <el-input v-model="query" placeholder="搜索姓名" clearable style="width: 200px" />
          </div>
        </template>
        <el-table
          :data="filteredRows"
          size="small"
          border
          height="580"

        >
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
              <span v-if="col.kind === 'delta'" :class="toneClass(asNumber(col.get(row)))">
                {{ fmtRankDelta(asNumber(col.get(row))) }}
              </span>
              <span v-else-if="col.kind === 'scoreDelta'" :class="toneClass(asNumber(col.get(row)))">
                {{ fmtDelta(asNumber(col.get(row))) }}
              </span>
              <span v-else-if="col.kind === 'score'">{{ fmtScore(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'rank'">{{ asNumber(col.get(row)) ?? '—' }}</span>
              <span v-else-if="col.kind === 'num'">{{ col.get(row) }}</span>
              <span v-else>{{ col.get(row) || '' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <div v-show="tab === 'subject'" class="tab-panel">
      <el-radio-group v-model="subject" class="subject-tabs">
        <el-radio-button v-for="item in result.subjects" :key="item" :value="item">
          {{ item }}
        </el-radio-button>
      </el-radio-group>

      <el-card v-if="currentStat" shadow="never" class="subject-kpis">
        <span>
          均分 <strong>{{ fmtScore(currentStat.firstAvg) }}</strong> →
          <strong>{{ fmtScore(currentStat.lastAvg) }}</strong>
          <em :class="toneClass(currentStat.avgDelta)">{{ fmtDelta(currentStat.avgDelta) }}</em>
        </span>
        <span>
          名次上升 <strong class="tone-up">{{ currentStat.up }}</strong> / 下降
          <strong class="tone-down">{{ currentStat.down }}</strong> / 持平 {{ currentStat.flat }}
        </span>
        <span v-if="currentStat.passMark != null">
          及格线 {{ currentStat.passMark }}：{{ currentStat.firstPassCount ?? '—' }} →
          {{ currentStat.lastPassCount ?? '—' }} 人
        </span>
      </el-card>

      <el-card shadow="never">
        <el-table
          :data="filteredRows"
          size="small"
          border
          height="560"

        >
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
              <span v-if="col.kind === 'delta'" :class="toneClass(asNumber(col.get(row)))">
                {{ fmtRankDelta(asNumber(col.get(row))) }}
              </span>
              <span v-else-if="col.kind === 'scoreDelta'" :class="toneClass(asNumber(col.get(row)))">
                {{ fmtDelta(asNumber(col.get(row))) }}
              </span>
              <span v-else-if="col.kind === 'score'">{{ fmtScore(asNumber(col.get(row))) }}</span>
              <span v-else-if="col.kind === 'rank'">{{ asNumber(col.get(row)) ?? '—' }}</span>
              <span v-else-if="col.kind === 'num'">{{ col.get(row) }}</span>
              <span v-else>{{ col.get(row) || '' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <div v-show="tab === 'notes'" class="tab-panel">
      <el-row :gutter="14">
        <el-col :xs="24" :md="12">
          <el-card shadow="never">
            <template #header><strong>数据提醒</strong></template>
            <ul v-if="result.warnings.length" class="warning-list">
              <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
            </ul>
            <p v-else class="muted">没有发现明显的数据问题。</p>
          </el-card>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-card shadow="never">
            <template #header><strong>口径说明</strong></template>
            <ul class="note-list">
              <li>场次顺序：{{ result.labels.join(' → ') }}；第一场为基准。</li>
              <li>排名变化 = 首场名次 − 末场名次；分数变化 = 末场分数 − 首场分数。</li>
              <li>中间场次展示分数与排名，不单独计算变化。</li>
              <li>
                排名方式：{{ result.options.rankMode === 'competition' ? '并列名次（同分同名次、后续跳号）' : '顺序名次（同分按顺序编号）' }}。
              </li>
              <li>姓名按“姓名列”匹配；缺场的学生在对应场次为空，并标注“仅 N 场有成绩”。</li>
              <li>所有数据仅在本机浏览器处理，不上传服务器。</li>
            </ul>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div class="result-footer no-print">
      <span class="muted small">数据来源：{{ result.fileName }}</span>
      <el-button link type="primary" @click="emit('reset')">重新开始</el-button>
    </div>

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
        <el-button type="primary" :loading="exporting" @click="dialogVisible = false; emit('exportXlsx')">
          导出 Excel
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>



