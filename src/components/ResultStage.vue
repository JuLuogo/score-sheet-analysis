<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExportSelection, SeriesAnalysis, SeriesStudent } from '../types'
import ChartPanel from './ChartPanel.vue'
import PanelBox from './PanelBox.vue'
import { CHART_FONT } from '../lib/echarts'
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
  color: ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#38bdf8'],
  textStyle: CHART_FONT,
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(4,16,32,.94)',
    borderColor: 'rgba(56,189,248,.3)',
  },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: '#8aa6c8' } },
  grid: { left: 38, right: 14, top: 34, bottom: 24 },
  xAxis: {
    type: 'category',
    data: props.result.labels,
    boundaryGap: false,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: 'rgba(56,189,248,.25)' } },
    axisLabel: { color: '#8aa6c8', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(56,189,248,.08)' } },
    axisLabel: { color: '#6f8db0', fontSize: 11 },
  },
  series: props.result.subjects.map((item) => ({
    name: item,
    type: 'line',
    smooth: true,
    symbolSize: 5,
    data: props.result.examStats.map((stat) => stat.subjectAvg[item]),
    lineStyle: { width: 2 },
  })),
}))

const bucketOption = computed(() => ({
  color: ['#1e5f99', '#22d3ee'],
  textStyle: CHART_FONT,
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(4,16,32,.94)',
    borderColor: 'rgba(56,189,248,.3)',
  },
  legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: '#8aa6c8' } },
  grid: { left: 34, right: 12, top: 30, bottom: 22 },
  xAxis: {
    type: 'category',
    data: props.result.buckets.map((bucket) => bucket.label),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: 'rgba(56,189,248,.25)' } },
    axisLabel: { color: '#8aa6c8', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(56,189,248,.08)' } },
    axisLabel: { color: '#6f8db0', fontSize: 10 },
  },
  series: [
    { name: first.value, type: 'bar', barMaxWidth: 18, data: props.result.buckets.map((b) => b.first), label: { show: true, position: 'top', fontSize: 9, color: '#8aa6c8' } },
    { name: last.value, type: 'bar', barMaxWidth: 18, data: props.result.buckets.map((b) => b.last), label: { show: true, position: 'top', fontSize: 9, color: '#22d3ee' } },
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
    textStyle: { fontFamily: CHART_FONT.fontFamily, color: '#8aa6c8' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(4,16,32,.94)',
      borderColor: 'rgba(56,189,248,.3)',
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
      axisLine: { lineStyle: { color: 'rgba(56,189,248,.25)' } },
      axisLabel: { color: '#8aa6c8' },
    },
    yAxis: {
      type: 'value',
      inverse: true,
      min: 1,
      max: axisMax,
      interval: axisMax <= 10 ? 1 : axisMax / 5,
      splitLine: { lineStyle: { color: 'rgba(56,189,248,.08)' } },
      axisLabel: { color: '#6f8db0' },
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

const printPage = () => window.print()
</script>

<template>
  <div class="stage result-stage">
    <div class="result-top">
      <div class="result-title">
        <el-input
          :model-value="className"
          class="class-name-input"
          @update:model-value="(value: string) => emit('update:className', value)"
        />
        <span class="result-sub">
          {{ result.labels.join('  →  ') }} · 全程参考 {{ result.counts.comparableAll }} 人
        </span>
      </div>
      <div class="result-actions">
        <el-button size="small" @click="emit('back')">返回场次</el-button>
        <el-button size="small" @click="dialogVisible = true">导出内容（{{ exportCount }}/5）</el-button>
        <el-button size="small" :loading="exporting" @click="emit('exportCsv')">CSV</el-button>
        <el-button size="small" :disabled="saved" @click="emit('save')">
          {{ saved ? '已存本机' : '存本机' }}
        </el-button>
        <el-button size="small" type="primary" :loading="exporting" @click="emit('exportXlsx')">
          导出 Excel
        </el-button>
        <el-button size="small" @click="printPage">打印</el-button>
      </div>
    </div>

    <div class="kpi-strip">
      <div class="kpi">
        <span class="kpi-label">考试场次</span>
        <strong class="kpi-value">{{ result.labels.length }}</strong>
        <span class="kpi-sub">{{ result.labels.join(' / ') }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">总分均分</span>
        <strong class="kpi-value" :class="toneClass(result.totalStat.avgDelta)">
          {{ fmtScore(result.totalStat.lastAvg) }}
        </strong>
        <span class="kpi-sub">{{ first }} {{ fmtScore(result.totalStat.firstAvg) }} · {{ fmtDelta(result.totalStat.avgDelta) }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">最高分</span>
        <strong class="kpi-value">{{ fmtScore(result.totalStat.lastMax) }}</strong>
        <span class="kpi-sub">{{ first }} {{ fmtScore(result.totalStat.firstMax) }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">总分名次</span>
        <strong class="kpi-value"><em class="tone-up">↑{{ result.counts.totalUp }}</em> / <em class="tone-down">↓{{ result.counts.totalDown }}</em></strong>
        <span class="kpi-sub">持平 {{ result.counts.totalFlat }} 人（{{ first }} → {{ last }}）</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">单科名次变化</span>
        <strong class="kpi-value"><em class="tone-up">↑{{ result.counts.subjectUp }}</em> / <em class="tone-down">↓{{ result.counts.subjectDown }}</em></strong>
        <span class="kpi-sub">{{ result.students.length }} 人 × {{ result.subjects.length }} 科</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">全程参考</span>
        <strong class="kpi-value">{{ result.counts.comparableAll }}</strong>
        <span class="kpi-sub">仅首场 {{ result.counts.firstOnly }} · 仅末场 {{ result.counts.lastOnly }}</span>
      </div>
    </div>

    <div class="result-main">
      <div class="result-col">
        <PanelBox title="各科均分趋势" class="dense">
          <template #extra>按场次顺序</template>
          <ChartPanel :option="avgOption" :height="205" />
        </PanelBox>
        <PanelBox title="总分分数段" class="dense">
          <template #extra>首场 vs 末场</template>
          <ChartPanel :option="bucketOption" :height="200" />
        </PanelBox>
      </div>

      <div class="result-col">
        <PanelBox title="总分排名迁移" class="dense">
          <template #extra>Top {{ trajectoryStudents.length }} 学生 · 名次越靠上越好</template>
          <ChartPanel :option="bumpOption" :height="432" />
        </PanelBox>
      </div>

      <div class="result-col">
        <PanelBox title="进步榜 TOP5" class="dense">
          <template #extra>{{ first }} → {{ last }}</template>
          <div v-for="(student, index) in upTop" :key="student.key" class="mover-item">
            <span class="mover-index">{{ index + 1 }}</span>
            <span class="mover-name">{{ student.name }}</span>
            <span class="mover-score">
              {{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}
            </span>
            <span class="mover-delta tone-up">{{ fmtRankDelta(student.totalRankDelta) }}</span>
          </div>
        </PanelBox>
        <PanelBox title="需关注 TOP5" class="dense">
          <template #extra>{{ first }} → {{ last }}</template>
          <div v-for="(student, index) in downTop" :key="student.key" class="mover-item">
            <span class="mover-index">{{ index + 1 }}</span>
            <span class="mover-name">{{ student.name }}</span>
            <span class="mover-score">
              {{ fmtScore(student.totals[0]) }} → {{ fmtScore(student.totals[student.totals.length - 1]) }}
            </span>
            <span class="mover-delta tone-down">{{ fmtRankDelta(student.totalRankDelta) }}</span>
          </div>
        </PanelBox>
      </div>
    </div>

    <PanelBox class="result-bottom" dense>
      <div class="result-tabs">
        <button :class="{ active: tab === 'overview' }" @click="tab = 'overview'">科目统计</button>
        <button :class="{ active: tab === 'summary' }" @click="tab = 'summary'">汇总矩阵</button>
        <button :class="{ active: tab === 'subject' }" @click="tab = 'subject'">单科矩阵</button>
        <button :class="{ active: tab === 'notes' }" @click="tab = 'notes'">数据说明</button>
        <span class="muted small" style="margin-left: auto">
          {{ result.students.length }} 人 · {{ result.subjects.length }} 科 · {{ result.labels.length }} 场
        </span>
      </div>

      <div class="result-bottom-body">
        <template v-if="tab === 'overview'">
          <el-table :data="[...result.stats, result.totalStat]" size="small" height="210" border>
            <el-table-column prop="subject" label="科目" width="90" fixed />
            <el-table-column label="均分（首 → 末）" min-width="150">
              <template #default="{ row }">{{ fmtScore(row.firstAvg) }} → {{ fmtScore(row.lastAvg) }}</template>
            </el-table-column>
            <el-table-column label="变化" width="80">
              <template #default="{ row }"><span :class="toneClass(row.avgDelta)">{{ fmtDelta(row.avgDelta) }}</span></template>
            </el-table-column>
            <el-table-column label="最高（首 → 末）" min-width="140">
              <template #default="{ row }">{{ fmtScore(row.firstMax) }} → {{ fmtScore(row.lastMax) }}</template>
            </el-table-column>
            <el-table-column label="最低（首 → 末）" min-width="140">
              <template #default="{ row }">{{ fmtScore(row.firstMin) }} → {{ fmtScore(row.lastMin) }}</template>
            </el-table-column>
            <el-table-column label="名次↑" width="70"><template #default="{ row }"><span class="tone-up">{{ row.up }}</span></template></el-table-column>
            <el-table-column label="名次↓" width="70"><template #default="{ row }"><span class="tone-down">{{ row.down }}</span></template></el-table-column>
            <el-table-column prop="flat" label="持平" width="60" />
            <el-table-column label="及格人数" width="100">
              <template #default="{ row }">
                {{ row.passMark == null ? '—' : `${row.firstPassCount ?? '—'} → ${row.lastPassCount ?? '—'}` }}
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else-if="tab === 'summary'">
          <div class="table-head">
            <el-input v-model="query" placeholder="搜索姓名" clearable size="small" style="width: 180px" />
          </div>
          <el-table :data="filteredRows" size="small" height="180" border>
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
        </template>

        <template v-else-if="tab === 'subject'">
          <div class="table-head">
            <el-radio-group v-model="subject" size="small">
              <el-radio-button v-for="item in result.subjects" :key="item" :value="item">{{ item }}</el-radio-button>
            </el-radio-group>
            <span class="muted small" v-if="currentStat">
              均分 {{ fmtScore(currentStat.firstAvg) }} → {{ fmtScore(currentStat.lastAvg) }}
              <em :class="toneClass(currentStat.avgDelta)">{{ fmtDelta(currentStat.avgDelta) }}</em>
              · 名次↑{{ currentStat.up }} / ↓{{ currentStat.down }}
            </span>
          </div>
          <el-table :data="filteredRows" size="small" height="170" border>
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
        </template>

        <template v-else>
          <el-row :gutter="16">
            <el-col :span="12">
              <ul v-if="result.warnings.length" class="warning-list">
                <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
              </ul>
              <p v-else class="muted">没有发现明显的数据问题。</p>
            </el-col>
            <el-col :span="12">
              <ul class="note-list">
                <li>场次顺序：{{ result.labels.join(' → ') }}；第一场为基准。</li>
                <li>排名变化 = 首场名次 − 末场名次；分数变化 = 末场分数 − 首场分数。</li>
                <li>中间场次展示分数与排名，不单独计算变化。</li>
                <li>排名方式：{{ result.options.rankMode === 'competition' ? '并列名次（同分同名次、后续跳号）' : '顺序名次（同分按顺序编号）' }}。</li>
                <li>姓名按“姓名列”匹配；缺场学生对应位置为空。</li>
              </ul>
            </el-col>
          </el-row>
        </template>
      </div>
    </PanelBox>

    <div class="result-footer">
      <span>数据来源：{{ result.fileName }}</span>
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






