<script setup lang="ts">
import { computed } from 'vue'
import type { ExamDraft, ExportSelection } from '../types'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import PanelBox from './PanelBox.vue'

const props = defineProps<{
  drafts: ExamDraft[]
  selectedIds: string[]
  selection: ExportSelection
  error: string
}>()

const emit = defineEmits<{
  toggle: [id: string]
  move: [id: string, delta: number]
  selection: [value: ExportSelection]
  back: []
  run: []
}>()

const EXPORT_ITEMS: { key: keyof ExportSelection; label: string; desc: string }[] = [
  { key: 'summary', label: '汇总总览', desc: '一人一行，含各场总分、排名与名次变化' },
  { key: 'total', label: '总分明细', desc: '总分矩阵 + 分数变化 + 排名变化' },
  { key: 'subjects', label: '各科分表', desc: '每个科目一张表，横向列出各场分数' },
  { key: 'stats', label: '科目统计', desc: '首末场均分、最高最低、名次升降人数' },
  { key: 'notes', label: '说明页', desc: '口径、场次、数据提醒' },
]

const selected = computed(() =>
  props.selectedIds
    .map((id) => props.drafts.find((draft) => draft.id === id))
    .filter((draft): draft is ExamDraft => Boolean(draft)),
)
const rest = computed(() => props.drafts.filter((draft) => !props.selectedIds.includes(draft.id)))
const canRun = computed(
  () => selected.value.length >= 2 && Object.values(props.selection).some(Boolean),
)

const subjectCount = computed(
  () => new Set(props.drafts.flatMap((draft) => draft.config.subjectCols.map((item) => item.name))).size,
)

const sheetCount = computed(() => {
  let count = 0
  if (props.selection.summary) count += 1
  if (props.selection.total) count += 1
  if (props.selection.subjects) count += subjectCount.value
  if (props.selection.stats) count += 1
  if (props.selection.notes) count += 1
  return count
})

const toggleSelection = (key: keyof ExportSelection, value: boolean) => {
  emit('selection', { ...props.selection, [key]: value })
}
</script>

<template>
  <div class="stage select-stage">
    <div class="stage-head">
      <div>
        <h1>选择对比场次与导出内容</h1>
        <p class="stage-sub">第一场为基准；名次与分数变化按“第一场 → 最后一场”计算。</p>
      </div>
      <div class="row-gap">
        <el-button @click="emit('back')">返回字段</el-button>
        <el-button type="primary" :disabled="!canRun" @click="emit('run')">开始分析</el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-16" />

    <div class="select-layout">
      <PanelBox :title="`参与对比的考试（${selected.length}）`" class="dense">
        <template #extra>顺序即展示顺序，第一场为基准</template>
        <div class="compare-list">
          <div v-for="(draft, index) in selected" :key="draft.id" class="compare-item">
            <el-checkbox :model-value="true" @change="emit('toggle', draft.id)" />
            <el-tag :type="index === 0 ? 'primary' : 'info'" size="small" effect="dark">
              {{ index === 0 ? '基准' : index + 1 }}
            </el-tag>
            <div class="compare-main">
              <strong>{{ draft.label }}</strong>
              <span>{{ draft.workbook.fileName }}</span>
            </div>
            <div class="row-gap">
              <el-button size="small" text :disabled="index === 0" @click="emit('move', draft.id, -1)">
                <el-icon><ArrowUp /></el-icon>
              </el-button>
              <el-button size="small" text :disabled="index === selected.length - 1" @click="emit('move', draft.id, 1)">
                <el-icon><ArrowDown /></el-icon>
              </el-button>
            </div>
          </div>
          <el-empty v-if="selected.length < 2" description="至少勾选 2 场" :image-size="52" />
        </div>
        <div v-if="selected.length" class="flow-preview">
          <template v-for="(draft, index) in selected" :key="`flow-${draft.id}`">
            <span v-if="index > 0" class="flow-arrow">→</span>
            <div class="flow-node">
              <strong>{{ draft.label }}</strong>
              <span>{{ index === 0 ? '基准场次' : `第 ${index + 1} 场` }} · {{ draft.rows.length }} 行</span>
            </div>
          </template>
        </div>

        <template v-if="rest.length">
          <el-divider content-position="left">未参与</el-divider>
          <div class="compare-list">
            <div v-for="draft in rest" :key="draft.id" class="compare-item muted-item">
              <el-checkbox :model-value="false" @change="emit('toggle', draft.id)" />
              <el-tag type="info" size="small">—</el-tag>
              <div class="compare-main">
                <strong>{{ draft.label }}</strong>
                <span>{{ draft.workbook.fileName }}</span>
              </div>
            </div>
          </div>
        </template>
      </PanelBox>

      <PanelBox title="导出哪些表" class="dense">
        <template #extra>只导出勾选的工作表</template>
        <div class="export-list">
          <label v-for="item in EXPORT_ITEMS" :key="item.key" class="export-item">
            <el-checkbox
              :model-value="selection[item.key]"
              @change="(value: boolean) => toggleSelection(item.key, value)"
            />
            <div class="export-main">
              <strong>{{ item.label }}</strong>
              <small>{{ item.desc }}</small>
            </div>
          </label>
        </div>
        <div class="export-summary">
          <div class="export-stat"><span>参与场次</span><strong>{{ selected.length }}</strong></div>
          <div class="export-stat"><span>学生科目</span><strong>{{ subjectCount }}</strong></div>
          <div class="export-stat"><span>预计工作表</span><strong>{{ sheetCount }}</strong></div>
        </div>
        <p class="muted small mt-12">结果页仍可随时修改导出项；CSV 固定导出“汇总总览”。</p>
      </PanelBox>
    </div>

    <div class="floating-actions">
      <span>
        {{ selected.length }} 场：
        {{ selected.map((draft, index) => (index === 0 ? `${draft.label}（基准）` : draft.label)).join(' → ') }}
      </span>
      <el-button type="primary" :disabled="!canRun" @click="emit('run')">开始分析</el-button>
    </div>
  </div>
</template>


