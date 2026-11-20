<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import type { ExamDraft, HistoryItem } from '../types'

defineProps<{
  drafts: ExamDraft[]
  busy: boolean
  history: HistoryItem[]
  error: string
}>()

const emit = defineEmits<{
  files: [files: File[]]
  demo: []
  remove: [id: string]
  next: []
  restore: [item: HistoryItem]
  removeHistory: [id: string]
}>()

const uploadRef = ref<UploadInstance>()

const handleChange = (file: UploadFile) => {
  if (file.raw) emit('files', [file.raw])
  uploadRef.value?.clearFiles()
}
</script>

<template>
  <div class="stage upload-stage">
    <div class="upload-head">
      <div>
        <h1>上传成绩单</h1>
        <p>至少 2 份，可一次多选。支持 .xlsx / .xlsm / .csv，上传后再选择对比场次。</p>
      </div>
      <el-button link type="primary" @click="emit('demo')">没有文件？看示例</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-16" />

    <el-upload
      ref="uploadRef"
      drag
      multiple
      :auto-upload="false"
      :show-file-list="false"
      accept=".xlsx,.xlsm,.csv"
      class="upload-drop"
      :on-change="handleChange"
    >
      <el-icon class="upload-icon"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        {{ busy ? '正在解析…' : '拖拽成绩单到这里，或点击选择（可多选）' }}
      </div>
      <template #tip>
        <div class="el-upload__tip">第一次月考、第二次月考、期中考试……都能一起传</div>
      </template>
    </el-upload>

    <el-table v-if="drafts.length" :data="drafts" class="mt-16" size="small">
      <el-table-column type="index" label="#" width="52" />
      <el-table-column prop="label" label="考试名称" min-width="140">
        <template #default="{ row }">
          <strong>{{ row.label }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="文件" min-width="220">
        <template #default="{ row }">
          <span class="muted">{{ row.workbook.fileName }}</span>
        </template>
      </el-table-column>
      <el-table-column label="行数" width="80">
        <template #default="{ row }">{{ row.rows.length }}</template>
      </el-table-column>
      <el-table-column label="科目" width="80">
        <template #default="{ row }">{{ row.config.subjectCols.length }}</template>
      </el-table-column>
      <el-table-column label="操作" width="86" align="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="emit('remove', row.id)">移除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="upload-actions">
      <span class="muted">
        {{ drafts.length ? `已添加 ${drafts.length} 份，至少需要 2 份` : '尚未添加文件' }}
      </span>
      <el-button type="primary" :disabled="drafts.length < 2" @click="emit('next')">
        下一步：确认字段
      </el-button>
    </div>

    <el-card v-if="history.length" shadow="never" class="mt-24">
      <template #header>
        <div class="card-head">
          <span>最近分析</span>
          <span class="muted small">保存在本机，可恢复</span>
        </div>
      </template>
      <div v-for="item in history" :key="item.id" class="history-row">
        <div>
          <strong>{{ item.title }}</strong>
          <span class="muted small">
            {{ item.labels.join(' → ') }} · {{ new Date(item.createdAt).toLocaleString('zh-CN') }}
          </span>
        </div>
        <div class="row-gap">
          <el-button size="small" @click="emit('restore', item)">恢复</el-button>
          <el-button size="small" link type="danger" @click="emit('removeHistory', item.id)">删除</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>
