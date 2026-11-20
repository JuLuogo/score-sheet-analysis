<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AnalysisOptions, ExamConfig, ExamDraft, Template } from '../types'
import { detectHeaderRow, guessConfig } from '../lib/parse'
import { Delete } from '@element-plus/icons-vue'

type Status = { ok: true; count: number; subjects: number } | { ok: false; message: string }

const props = defineProps<{
  drafts: ExamDraft[]
  activeId: string | null
  options: AnalysisOptions
  templates: Template[]
  error: string
  status: (draft: ExamDraft) => Status
}>()

const emit = defineEmits<{
  select: [id: string]
  update: [id: string, patch: Partial<ExamDraft>]
  remove: [id: string]
  back: []
  next: []
  options: [value: AnalysisOptions]
  saveTemplate: [name: string]
  applyTemplate: [template: Template]
  deleteTemplate: [id: string]
}>()

const templateName = ref('')
const active = computed(
  () => props.drafts.find((draft) => draft.id === props.activeId) ?? props.drafts[0],
)
const allOk = computed(() => props.drafts.every((draft) => props.status(draft).ok))

const subjects = computed(() => {
  const list: string[] = []
  for (const draft of props.drafts) {
    for (const item of draft.config.subjectCols) {
      if (item.name && !list.includes(item.name)) list.push(item.name)
    }
  }
  return list
})

const header = computed(() => active.value?.rows[active.value.headerRow] ?? [])
const width = computed(() => {
  if (!active.value) return 1
  const rows = active.value.rows.slice(0, 12)
  return Math.max(...rows.map((row) => row.length), header.value.length, 1)
})
const headerOptions = computed(() =>
  Array.from({ length: width.value }, (_, index) => ({
    index,
    text:
      header.value[index] == null || String(header.value[index]).trim() === ''
        ? `第 ${index + 1} 列`
        : String(header.value[index]),
  })),
)

const numericCols = computed(() => {
  const set = new Set<number>()
  if (!active.value) return set
  for (let col = 0; col < width.value; col += 1) {
    const hit = active.value.rows
      .slice(active.value.headerRow + 1, active.value.headerRow + 9)
      .some((row) => {
        const value = row[col]
        if (typeof value === 'number') return Number.isFinite(value)
        if (typeof value !== 'string' || value.trim() === '') return false
        return !Number.isNaN(Number(value))
      })
    if (hit) set.add(col)
  }
  return set
})

const subjectOptions = computed(() => {
  if (!active.value) return []
  return headerOptions.value.filter(
    (item) =>
      numericCols.value.has(item.index) &&
      item.index !== active.value?.config.nameCol &&
      item.index !== active.value?.config.totalCol &&
      item.index !== active.value?.config.rankCol,
  )
})

const selectedCols = computed(() => active.value?.config.subjectCols.map((item) => item.col) ?? [])

const previewData = computed(() => {
  if (!active.value) return []
  const rows = active.value.rows.slice(active.value.headerRow + 1, active.value.headerRow + 5)
  return rows
    .filter((row) => row.some((cell) => cell != null && String(cell).trim() !== ''))
    .map((row) => {
      const record: Record<string, unknown> = {}
      for (let col = 0; col < previewCols.value; col += 1) {
        record[`c${col}`] = row[col] ?? ''
      }
      return record
    })
})
const previewCols = computed(() => {
  if (!active.value) return 1
  let last = 0
  header.value.forEach((cell, index) => {
    if (cell != null && String(cell).trim() !== '') last = index + 1
  })
  return Math.min(Math.max(last, 1), 12)
})

const update = (patch: Partial<ExamDraft>) => {
  if (active.value) emit('update', active.value.id, patch)
}

const patchConfig = (config: ExamConfig) => update({ config })

const changeSheet = (index: number) => {
  if (!active.value) return
  const rows = active.value.workbook.sheets[index]?.rows ?? []
  const headerRow = detectHeaderRow(rows)
  emit('update', active.value.id, {
    sheetIndex: index,
    rows,
    headerRow,
    config: guessConfig(rows, headerRow),
  })
}

const changeHeader = (row: number) => {
  if (!active.value) return
  emit('update', active.value.id, { headerRow: row, config: guessConfig(active.value.rows, row) })
}

const onSubjectsChange = (values: (string | number)[]) => {
  if (!active.value) return
  const cols = values.map((value) => Number(value))
  const subjectCols = cols
    .map((col) => ({ name: headerOptions.value[col]?.text ?? `第 ${col + 1} 列`, col }))
    .sort((a, b) => a.col - b.col)
  patchConfig({ ...active.value.config, subjectCols })
}

const markValue = (map: Record<string, number>, subject: string) =>
  map[subject] ?? undefined

const setMark = (kind: 'fullMarks' | 'passMarks', subject: string, value: number | undefined) => {
  const next = { ...props.options[kind] }
  if (value == null) delete next[subject]
  else next[subject] = value
  emit('options', { ...props.options, [kind]: next })
}

const statusSummary = (draft: ExamDraft) => {
  const result = props.status(draft)
  return result.ok ? `${result.count} 人 · ${result.subjects} 科` : "message" in result ? result.message : "数据有误"
}

const statusMessage = (draft: ExamDraft) => {
  const result = props.status(draft)
  return result.ok ? `识别到 ${result.count} 名学生、${result.subjects} 个科目` : "message" in result ? result.message : "数据有误"
}

const statusType = (draft: ExamDraft) => (props.status(draft).ok ? 'success' : 'error')

const cellClassName = ({ columnIndex }: { columnIndex: number }) => {
  if (!active.value) return ''
  if (columnIndex === active.value.config.nameCol) return 'col-name'
  if (selectedCols.value.includes(columnIndex)) return 'col-subject'
  return ''
}

const submitTemplate = () => {
  if (!templateName.value.trim()) return
  emit('saveTemplate', templateName.value.trim())
  templateName.value = ''
}

const applySelected = (id: string) => {
  const template = props.templates.find((item) => item.id === id)
  if (template) emit('applyTemplate', template)
}
</script>

<template>
  <div class="stage mapping-stage">
    <div class="stage-head">
      <div>
        <h1>确认每份成绩单的字段</h1>
        <p class="stage-sub">自动识别有误时手动改；左侧切换考试，改完一起进入下一步。</p>
      </div>
      <div class="row-gap">
        <el-button @click="emit('back')">返回上传</el-button>
        <el-button type="primary" :disabled="!allOk" @click="emit('next')">
          下一步：选择场次
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-16" />

    <div class="mapping-layout">
      <el-card shadow="never" class="exam-aside">
        <div
          v-for="(draft, index) in drafts"
          :key="draft.id"
          class="exam-aside-item"
          :class="{ active: draft.id === active?.id }"
          @click="emit('select', draft.id)"
        >
          <span class="exam-aside-index">{{ index + 1 }}</span>
          <div class="exam-aside-main">
            <strong>{{ draft.label }}</strong>
            <small>{{ statusSummary(draft) }}</small>
          </div>
          <el-icon :class="statusType(draft) === 'success' ? 'status-ok' : 'status-bad'">
            <CircleCheck v-if="statusType(draft) === 'success'" />
            <Warning v-else />
          </el-icon>
        </div>
      </el-card>

      <el-card v-if="active" shadow="never" class="mapping-panel">
        <template #header>
          <div class="card-head">
            <strong>{{ active.label }}</strong>
            <div class="row-gap">
              <span class="muted small">{{ active.workbook.fileName }}</span>
              <el-button
                link
                type="danger"
                :disabled="drafts.length <= 2"
                @click="emit('remove', active.id)"
              >
                移除
              </el-button>
            </div>
          </div>
        </template>

        <el-form label-position="top" class="mapping-form">
          <el-row :gutter="14">
            <el-col :xs="24" :sm="12">
              <el-form-item label="考试名称">
                <el-input
                  :model-value="active.label"
                  @update:model-value="(value: string) => update({ label: value })"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="工作表">
                <el-select
                  :model-value="active.sheetIndex"
                  style="width: 100%"
                  @change="changeSheet"
                >
                  <el-option
                    v-for="(sheet, index) in active.workbook.sheets"
                    :key="`${sheet.name}-${index}`"
                    :label="`${sheet.name}（${sheet.rows.length} 行）`"
                    :value="index"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="表头所在行">
                <el-select :model-value="active.headerRow" style="width: 100%" @change="changeHeader">
                  <el-option
                    v-for="(row, index) in active.rows.slice(0, 12)"
                    :key="index"
                    :label="`第 ${index + 1} 行：${row
                      .slice(0, 5)
                      .map((cell) => (cell == null ? '' : String(cell)))
                      .filter(Boolean)
                      .join('、')
                      .slice(0, 26)}`"
                    :value="index"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="姓名列">
                <el-select
                  :model-value="active.config.nameCol"
                  style="width: 100%"
                  @change="(value: number) => patchConfig({ ...active.config, nameCol: value })"
                >
                  <el-option
                    v-for="item in headerOptions"
                    :key="item.index"
                    :label="item.text"
                    :value="item.index"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="总分列">
                <el-select
                  :model-value="active.config.totalCol ?? ''"
                  style="width: 100%"
                  @change="(value: number | '') => patchConfig({ ...active.config, totalCol: value === '' ? null : Number(value) })"
                >
                  <el-option label="按科目求和" value="" />
                  <el-option
                    v-for="item in headerOptions"
                    :key="item.index"
                    :label="item.text"
                    :value="item.index"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="原表排名列（可选）">
                <el-select
                  :model-value="active.config.rankCol ?? ''"
                  style="width: 100%"
                  @change="(value: number | '') => patchConfig({ ...active.config, rankCol: value === '' ? null : Number(value) })"
                >
                  <el-option label="不使用" value="" />
                  <el-option
                    v-for="item in headerOptions"
                    :key="item.index"
                    :label="item.text"
                    :value="item.index"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <div class="subject-picker">
          <div class="field-label">科目列（勾选参与统计的列）</div>
          <el-checkbox-group :model-value="selectedCols" @change="onSubjectsChange">
            <el-checkbox-button v-for="item in subjectOptions" :key="item.index" :value="item.index">
              {{ item.text }}
            </el-checkbox-button>
          </el-checkbox-group>
        </div>

        <el-table
          :data="previewData"
          size="small"
          class="mt-12 preview-table"
          :cell-class-name="cellClassName"
          border
        >
          <el-table-column
            v-for="col in previewCols"
            :key="col"
            :prop="`c${col}`"
            :label="String(header[col] ?? '')"
            min-width="72"
          />
        </el-table>

        <el-alert
          class="mt-12"
          :type="statusType(active)"
          :title="statusMessage(active)"
          :closable="false"
          show-icon
        />
      </el-card>
    </div>

    <el-card shadow="never" class="mt-16">
      <template #header>
        <div class="card-head">
          <strong>分析口径</strong>
          <span class="muted small">影响名次与及格统计</span>
        </div>
      </template>
      <el-row :gutter="24">
        <el-col :xs="24" :sm="12">
          <div class="field-label">排名方式</div>
          <el-radio-group
            :model-value="options.rankMode"
            @change="(value) => emit('options', { ...options, rankMode: value as AnalysisOptions['rankMode'] })"
          >
            <el-radio-button value="competition">并列名次</el-radio-button>
            <el-radio-button value="sequential">顺序名次</el-radio-button>
          </el-radio-group>
          <div class="field-hint">
            {{ options.rankMode === 'competition' ? '同分同名次，后续名次跳号（1、2、2、4）' : '同分按出现顺序编号' }}
          </div>
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="field-label">分数段宽度</div>
          <el-select
            :model-value="options.bucketSize"
            @change="(value: number) => emit('options', { ...options, bucketSize: value })"
          >
            <el-option v-for="size in [20, 30, 40, 50, 60, 100]" :key="size" :label="`${size} 分一段`" :value="size" />
          </el-select>
          <div class="field-hint">用于首末场分数段对比</div>
        </el-col>
      </el-row>

      <el-table :data="subjects.map((subject) => ({ subject }))" size="small" class="mt-16" border>
        <el-table-column prop="subject" label="科目" width="140" />
        <el-table-column label="满分（可选）" width="180">
          <template #default="{ row }">
            <el-input-number
              :model-value="markValue(options.fullMarks, row.subject)"
              :min="0"
              :controls="false"
              placeholder="如 120"
              style="width: 120px"
              @change="(value?: number) => setMark('fullMarks', row.subject, value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="及格线（可选）" width="180">
          <template #default="{ row }">
            <el-input-number
              :model-value="markValue(options.passMarks, row.subject)"
              :min="0"
              :controls="false"
              placeholder="如 72"
              style="width: 120px"
              @change="(value?: number) => setMark('passMarks', row.subject, value)"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="mt-16">
      <template #header>
        <div class="card-head">
          <strong>字段模板</strong>
          <span class="muted small">下次同类成绩单自动按表头匹配</span>
        </div>
      </template>
      <div class="template-save">
        <el-input v-model="templateName" placeholder="模板名称，如：24汽修月考模板" style="max-width: 280px" />
        <el-button :disabled="!templateName.trim()" @click="submitTemplate">保存当前字段</el-button>
        <el-select
          v-if="templates.length"
          placeholder="应用模板…"
          style="width: 200px"
          @change="applySelected"
        >
          <el-option v-for="item in templates" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button
          v-for="item in templates"
          :key="`del-${item.id}`"
          link
          type="danger"
          @click="emit('deleteTemplate', item.id)"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </el-card>

    <div class="floating-actions">
      <span>
        共 {{ drafts.length }} 份 ·
        {{ allOk ? '字段检查通过' : '还有未通过的字段，请检查左侧红色标记' }}
      </span>
      <el-button type="primary" :disabled="!allOk" @click="emit('next')">下一步：选择场次</el-button>
    </div>
  </div>
</template>





