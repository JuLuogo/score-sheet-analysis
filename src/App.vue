<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type {
  AnalysisOptions,
  ExamConfig,
  ExamData,
  ExamDraft,
  ExportSelection,
  HistoryItem,
  Template,
} from './types'
import { analyzeSeries } from './lib/analyze'
import { buildExam, detectHeaderRow, guessConfig, parseFile } from './lib/parse'
import { makeDemo } from './lib/demo'
import { exportCsv, exportXlsx } from './lib/export'
import {
  addHistory,
  loadHistory,
  loadOptions,
  loadTemplates,
  removeHistory,
  removeTemplate,
  saveOptions,
  upsertTemplate,
} from './lib/storage'
import UploadStage from './components/UploadStage.vue'
import LandingUpload from './components/LandingUpload.vue'
import MappingStage from './components/MappingStage.vue'
import SelectStage from './components/SelectStage.vue'
import ResultStage from './components/ResultStage.vue'

type Stage = 'upload' | 'mapping' | 'select' | 'result'

const DEFAULT_OPTIONS: AnalysisOptions = {
  rankMode: 'competition',
  bucketSize: 50,
  fullMarks: {},
  passMarks: {},
}

const DEFAULT_SELECTION: ExportSelection = {
  summary: true,
  total: true,
  subjects: true,
  stats: true,
  notes: true,
}

const MARK_DEFAULTS: Record<string, [number, number]> = {
  语文: [120, 72],
  数学: [120, 72],
  英语: [120, 72],
  专业课: [200, 120],
  发动机: [100, 60],
}

const uid = () => `exam-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`

const stage = ref<Stage>('upload')
const drafts = ref<ExamDraft[]>([])
const activeId = ref<string | null>(null)
const selectedIds = ref<string[]>([])
const exams = ref<ExamData[]>([])
const options = ref<AnalysisOptions>(loadOptions() ?? DEFAULT_OPTIONS)
const selection = ref<ExportSelection>({ ...DEFAULT_SELECTION })
const DEFAULT_CLASS_NAME = '分析答案'
const FALLBACK_CLASS_NAME = '分析'
const className = ref(DEFAULT_CLASS_NAME)
const templates = ref<Template[]>(loadTemplates())
const history = ref<HistoryItem[]>(loadHistory())
const busy = ref(0)
const exporting = ref(false)
const saved = ref(false)
const error = ref('')

watch(
  options,
  (value) => {
    saveOptions(value)
  },
  { deep: true },
)

const landingActive = ref(true)
const showLanding = computed(() => landingActive.value && !result.value)

const result = computed(() => {
  if (exams.value.length < 2) return null
  try {
    return analyzeSeries(exams.value, options.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    return null
  }
})


const showError = (message: string) => {
  error.value = message
  ElMessage({ type: 'error', message, grouping: true })
}

const invalidateResult = () => {
  if (exams.value.length) {
    exams.value = []
    saved.value = false
  }
}

const updateDraft = (id: string, patch: Partial<ExamDraft>) => {
  invalidateResult()
  drafts.value = drafts.value.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
}

const addFiles = async (files: File[]) => {
  if (!files.length) return
  error.value = ''
  busy.value += files.length
  const created: ExamDraft[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      const workbook = await parseFile(file)
      const sheetIndex = 0
      const rows = workbook.sheets[sheetIndex].rows
      const headerRow = detectHeaderRow(rows)
      const base = file.name.replace(/\.(xlsx|xlsm|csv)$/i, '')
      created.push({
        id: uid(),
        label: base || `考试${drafts.value.length + created.length + 1}`,
        workbook,
        sheetIndex,
        rows,
        headerRow,
        config: guessConfig(rows, headerRow),
      })
    } catch (err) {
      errors.push(`${file.name}：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      busy.value = Math.max(0, busy.value - 1)
    }
  }
  if (created.length) {
    invalidateResult()
    drafts.value = [...drafts.value, ...created]
    if (!activeId.value) activeId.value = created[0].id
    selectedIds.value = [...selectedIds.value, ...created.map((draft) => draft.id)]
  }
  if (errors.length) showError(errors.join('；'))
}

const removeDraft = (id: string) => {
  invalidateResult()
  drafts.value = drafts.value.filter((draft) => draft.id !== id)
  selectedIds.value = selectedIds.value.filter((item) => item !== id)
  if (activeId.value === id) activeId.value = drafts.value[0]?.id ?? null
}

const buildFromDraft = (draft: ExamDraft): ExamData =>
  buildExam({
    id: draft.id,
    label: draft.label.trim() || '未命名考试',
    fileName: draft.workbook.fileName,
    sheetName: draft.workbook.sheets[draft.sheetIndex]?.name ?? '',
    rows: draft.rows,
    config: draft.config,
  })

const draftStatus = (draft: ExamDraft) => {
  try {
    const exam = buildFromDraft(draft)
    return { ok: true as const, count: exam.students.length, subjects: exam.subjects.length }
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
  }
}

const goMapping = () => {
  if (drafts.value.length < 2) {
    showError('至少上传 2 份成绩单才能对比')
    return
  }
  error.value = ''
  if (!activeId.value) activeId.value = drafts.value[0]?.id ?? null
  stage.value = 'mapping'
}

const startWorkspace = () => {
  if (drafts.value.length < 2) return
  landingActive.value = false
  goMapping()
}

const goSelect = () => {
  error.value = ''
  for (const draft of drafts.value) {
    const status = draftStatus(draft)
    if (!status.ok) {
      activeId.value = draft.id
      showError(`「${draft.label}」还有问题：${status.message}`)
      return
    }
  }
  const valid = selectedIds.value.filter((id) => drafts.value.some((draft) => draft.id === id))
  const missing = drafts.value.filter((draft) => !valid.includes(draft.id)).map((draft) => draft.id)
  selectedIds.value = [...valid, ...missing]
  stage.value = 'select'
}

const runAnalysis = () => {
  if (selectedIds.value.length < 2) {
    showError('至少选择 2 场考试')
    return
  }
  error.value = ''
  try {
    const picked = selectedIds.value
      .map((id) => drafts.value.find((draft) => draft.id === id))
      .filter((draft): draft is ExamDraft => Boolean(draft))
      .map(buildFromDraft)
    const subjects = [...new Set(picked.flatMap((exam) => exam.subjects))]
    const fullMarks = { ...options.value.fullMarks }
    const passMarks = { ...options.value.passMarks }
    for (const subject of subjects) {
      const preset = MARK_DEFAULTS[subject]
      if (!preset) continue
      if (fullMarks[subject] == null) fullMarks[subject] = preset[0]
      if (passMarks[subject] == null && preset[1]) passMarks[subject] = preset[1]
    }
    options.value = { ...options.value, fullMarks, passMarks }
    exams.value = picked
    saved.value = false
    resultView.value = 'rank'
    stage.value = 'result'
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
  }
}

const handleDemo = (to: 'mapping' | 'select' | 'result' = 'result') => {
  landingActive.value = false
  const demo = makeDemo()
  const nextDrafts: ExamDraft[] = demo.exams.map((exam) => ({
    id: exam.id,
    label: exam.label,
    workbook: { fileName: exam.fileName, sheets: [{ name: exam.sheetName, rows: exam.rows }] },
    sheetIndex: 0,
    rows: exam.rows,
    headerRow: exam.config.headerRow,
    config: exam.config,
  }))
  drafts.value = nextDrafts
  selectedIds.value = nextDrafts.map((draft) => draft.id)
  activeId.value = nextDrafts[0].id
  options.value = demo.options
  saved.value = false
  if (to === 'result') {
    exams.value = demo.exams
    resultView.value = 'rank'
    stage.value = 'result'
  } else {
    stage.value = to
  }
}

const applyTemplate = (template: Template) => {
  if (!drafts.value.length) {
    showError('请先上传成绩单，再应用模板')
    return
  }
  const mapDraft = (draft: ExamDraft): ExamDraft => {
    const header = draft.rows[draft.headerRow] ?? []
    const find = (name: string | null) =>
      name == null ? -1 : header.findIndex((cell) => String(cell ?? '').trim() === name)
    const nameCol = find(template.nameHeader)
    const totalCol = find(template.totalHeader)
    const rankCol = find(template.rankHeader)
    const subjectCols = template.subjectHeaders
      .map((name) => {
        const col = header.findIndex((cell) => String(cell ?? '').trim() === name)
        return col >= 0 ? { name, col } : null
      })
      .filter((item): item is { name: string; col: number } => item != null)
    const config: ExamConfig = {
      ...draft.config,
      nameCol: nameCol >= 0 ? nameCol : draft.config.nameCol,
      totalCol: totalCol >= 0 ? totalCol : draft.config.totalCol,
      rankCol: rankCol >= 0 ? rankCol : draft.config.rankCol,
      subjectCols: subjectCols.length ? subjectCols : draft.config.subjectCols,
    }
    return { ...draft, config }
  }
  drafts.value = drafts.value.map(mapDraft)
  options.value = { ...options.value, ...template.options }
  ElMessage.success(`已应用模板「${template.name}」`)
}

const saveTemplate = (name: string) => {
  const base = drafts.value.find((draft) => draft.id === activeId.value) ?? drafts.value[0]
  if (!base) return
  const header = base.rows[base.headerRow] ?? []
  const headerOf = (col: number | null) =>
    col == null ? null : String(header[col] ?? '').trim() || null
  templates.value = upsertTemplate({
    id: `tpl-${Date.now()}`,
    name,
    createdAt: Date.now(),
    subjects: base.config.subjectCols.map((item) => item.name),
    subjectHeaders: base.config.subjectCols.map((item) => String(header[item.col] ?? item.name)),
    nameHeader: headerOf(base.config.nameCol),
    totalHeader: headerOf(base.config.totalCol),
    rankHeader: headerOf(base.config.rankCol),
    options: options.value,
  })
  ElMessage.success('模板已保存')
}

const saveHistory = () => {
  if (!result.value) return
  history.value = addHistory({
    id: `hist-${Date.now()}`,
    createdAt: Date.now(),
    title: className.value.trim() || FALLBACK_CLASS_NAME,
    labels: result.value.labels,
    counts: result.value.counts,
    exams: exams.value,
    options: options.value,
    selection: selection.value,
  })
  saved.value = true
}

const restoreHistory = (item: HistoryItem) => {
  landingActive.value = false
  exams.value = item.exams
  options.value = item.options
  selection.value = item.selection
  className.value = item.title
  saved.value = true
  resultView.value = 'rank'
  stage.value = 'result'
}

const doExportXlsx = async () => {
  if (!result.value) return
  exporting.value = true
  try {
    await exportXlsx(result.value, className.value.trim() || FALLBACK_CLASS_NAME, selection.value)
    ElMessage.success('Excel 已生成')
  } catch (err) {
    showError(`导出失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    exporting.value = false
  }
}

const reset = () => {
  landingActive.value = true
  stage.value = 'upload'
  drafts.value = []
  selectedIds.value = []
  activeId.value = null
  exams.value = []
  error.value = ''
  saved.value = false
  className.value = DEFAULT_CLASS_NAME
}

const toggleSelected = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

const moveSelected = (id: string, delta: number) => {
  const index = selectedIds.value.indexOf(id)
  const target = index + delta
  if (index < 0 || target < 0 || target >= selectedIds.value.length) return
  const next = [...selectedIds.value]
  next.splice(index, 1)
  next.splice(target, 0, id)
  selectedIds.value = next
}

const deleteHistory = (id: string) => {
  history.value = removeHistory(id)
}

const deleteTemplate = (id: string) => {
  templates.value = removeTemplate(id)
}

const setOptions = (value: AnalysisOptions) => {
  options.value = value
}

const setSelection = (value: ExportSelection) => {
  selection.value = value
}

const setClassName = (value: string) => {
  className.value = value
}

const setActive = (id: string) => {
  activeId.value = id
}

const doExportCsv = () => {
  if (!result.value) return
  exportCsv(result.value, className.value.trim() || FALLBACK_CLASS_NAME)
}

type ResultView = 'rank' | 'trend' | 'bucket' | 'stats' | 'summary' | 'subject' | 'notes'
const resultView = ref<ResultView>('rank')

const menuGroups = computed(() => [
  {
    title: '数据准备',
    items: [
      { key: 'upload', label: '上传成绩单', enabled: true, badge: String(drafts.value.length || '') },
      { key: 'mapping', label: '确认字段', enabled: drafts.value.length >= 2, badge: '' },
      { key: 'select', label: '选择场次', enabled: drafts.value.length >= 2, badge: '' },
    ],
  },
  {
    title: '分析结果',
    items: [
      { key: 'rank', label: '排名浮动', enabled: Boolean(result.value), badge: '' },
      { key: 'trend', label: '各科趋势', enabled: Boolean(result.value), badge: '' },
      { key: 'bucket', label: '分数段分布', enabled: Boolean(result.value), badge: '' },
      { key: 'stats', label: '科目统计', enabled: Boolean(result.value), badge: '' },
      { key: 'summary', label: '汇总矩阵', enabled: Boolean(result.value), badge: '' },
      { key: 'subject', label: '单科矩阵', enabled: Boolean(result.value), badge: '' },
      { key: 'notes', label: '数据说明', enabled: Boolean(result.value), badge: String(result.value?.warnings.length || '') },
    ],
  },
])

const activeKey = computed(() => (stage.value === 'result' ? resultView.value : stage.value))

const currentTitle = computed(() => {
  const all = menuGroups.value.flatMap((group) => group.items)
  return all.find((item) => item.key === activeKey.value)?.label ?? '成绩单数据分析'
})

const goMenu = (key: string) => {
  if (key === 'upload' || key === 'mapping' || key === 'select') {
    if (key !== 'upload' && drafts.value.length < 2) return
    if (key === 'mapping' && !activeId.value) activeId.value = drafts.value[0]?.id ?? null
    error.value = ''
    stage.value = key
    return
  }
  if (!result.value) return
  resultView.value = key as ResultView
  stage.value = 'result'
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo')
  if (demo === '1') handleDemo('result')
  else if (demo === 'mapping') handleDemo('mapping')
  else if (demo === 'select') handleDemo('select')

  const view = params.get('view')
  const allowed: ResultView[] = ['rank', 'trend', 'bucket', 'stats', 'summary', 'subject', 'notes']
  if (view && allowed.includes(view as ResultView) && result.value) {
    resultView.value = view as ResultView
    stage.value = 'result'
  }
})
</script>
<template>
  <LandingUpload
    v-if="showLanding"
    :drafts="drafts"
    :busy="busy > 0"
    :error="error"
    :history="history"
    @files="addFiles"
    @remove="removeDraft"
    @next="startWorkspace"
    @demo="handleDemo('result')"
    @restore="restoreHistory"
    @remove-history="deleteHistory"
  />
  <div v-else class="shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="brand-dot">成</span>
        <div>
          <strong>成绩单数据分析</strong>
          <span>多场横向对比</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div v-for="group in menuGroups" :key="group.title" class="nav-group">
          <div class="nav-group-title">{{ group.title }}</div>
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="nav-item"
            :class="{ active: activeKey === item.key }"
            :disabled="!item.enabled"
            @click="goMenu(item.key)"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </button>
        </div>
      </nav>

      <div class="sidebar-footer">
        <span>本地处理 · 成绩不上传</span>
        <button v-if="drafts.length || result" type="button" class="reset-link" @click="reset">重新开始</button>
      </div>
    </aside>

    <div class="workspace">
      <header class="workspace-head">
        <div class="crumb">{{ currentTitle }}</div>
        <div class="workspace-meta">
          {{ result ? result.labels.join(' → ') : drafts.length ? `${drafts.length} 份成绩单` : '尚未接入成绩单' }}
        </div>
      </header>

      <main class="workspace-body">
        <UploadStage
          v-if="stage === 'upload'"
          :drafts="drafts"
          :busy="busy > 0"
          :history="history"
          :error="error"
          @files="addFiles"
          @demo="handleDemo('result')"
          @remove="removeDraft"
          @next="goMapping"
          @restore="restoreHistory"
          @remove-history="deleteHistory"
        />

        <MappingStage
          v-else-if="stage === 'mapping'"
          :drafts="drafts"
          :active-id="activeId"
          :options="options"
          :templates="templates"
          :error="error"
          :status="draftStatus"
          @select="setActive"
          @update="updateDraft"
          @remove="removeDraft"
          @back="stage = 'upload'"
          @next="goSelect"
          @options="setOptions"
          @save-template="saveTemplate"
          @apply-template="applyTemplate"
          @delete-template="deleteTemplate"
        />

        <SelectStage
          v-else-if="stage === 'select'"
          :drafts="drafts"
          :selected-ids="selectedIds"
          :selection="selection"
          :error="error"
          @toggle="toggleSelected"
          @move="moveSelected"
          @selection="setSelection"
          @back="stage = 'mapping'"
          @run="runAnalysis"
        />

        <ResultStage
          v-else-if="stage === 'result' && result"
          :result="result"
          :view="resultView"
          :class-name="className"
          :selection="selection"
          :exporting="exporting"
          :saved="saved"
          @update:class-name="setClassName"
          @selection="setSelection"
          @export-xlsx="doExportXlsx"
          @export-csv="doExportCsv"
          @save="saveHistory"
          @back="stage = 'select'"
          @reset="reset"
        />

        <div v-else class="placeholder">
          <p>{{ error || '暂无可分析的数据，请先上传成绩单。' }}</p>
          <el-button @click="stage = 'upload'">去上传</el-button>
        </div>
      </main>
    </div>
  </div>
</template>









