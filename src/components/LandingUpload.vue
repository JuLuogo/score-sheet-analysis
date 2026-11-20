<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import type { ExamDraft } from '../types'

defineProps<{ drafts: ExamDraft[]; busy: boolean; error: string }>()

const emit = defineEmits<{
  files: [files: File[]]
  remove: [id: string]
  next: []
  demo: []
}>()

const uploadRef = ref<UploadInstance>()

const handleChange = (file: UploadFile) => {
  if (file.raw) emit('files', [file.raw])
  uploadRef.value?.clearFiles()
}


</script>

<template>
  <div class="landing">
    <header class="landing-head">
      <div class="landing-brand">
        <span class="brand-dot">成</span>
        <div>
          <strong>成绩单数据分析</strong>
          <span>多场考试横向对比</span>
        </div>
      </div>
      <span class="landing-privacy">本地处理 · 成绩不上传</span>
    </header>

    <main class="landing-main" :class="{ 'has-files': drafts.length }">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="landing-alert" />

      <el-upload
        ref="uploadRef"
        drag
        multiple
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xlsm,.csv"
        class="landing-upload"
        :on-change="handleChange"
      >
        <div class="landing-drop">
          <el-icon class="landing-icon"><UploadFilled /></el-icon>
          <h1>{{ busy ? '正在读取成绩单…' : '拖入成绩单，或点击选择' }}</h1>
          <p>支持 .xlsx / .xlsm / .csv，可一次选择多份</p>
          <p v-if="!drafts.length" class="landing-hint">
            第一次月考、第二次月考、期中考试……都可以一起放进来
          </p>
        </div>
      </el-upload>

      <div v-if="drafts.length" class="landing-files">
        <div class="landing-files-head">
          <strong>已选择 {{ drafts.length }} 份成绩单</strong>
          <span>可以继续拖入，或移除不需要的</span>
        </div>
        <div v-for="(draft, index) in drafts" :key="draft.id" class="landing-file">
          <span class="landing-file-index">{{ index + 1 }}</span>
          <div class="landing-file-main">
            <strong>{{ draft.label }}</strong>
            <span>
              {{ draft.workbook.fileName }}
              <template v-if="draft.rows.length">· {{ draft.rows.length }} 行</template>
            </span>
          </div>
          <el-button link type="danger" @click="emit('remove', draft.id)">移除</el-button>
        </div>
      </div>

      <div v-if="drafts.length" class="landing-actions">
        <span class="landing-tip">
          {{ drafts.length < 2 ? '至少需要 2 份成绩单，再添加 1 份即可继续' : '下一步将确认表头、姓名列与科目列' }}
        </span>
        <el-button type="primary" size="large" :disabled="drafts.length < 2" @click="emit('next')">
          下一步
        </el-button>
      </div>
    </main>

    <footer class="landing-foot">
      <span>没有文件？<el-button link type="primary" @click="emit('demo')">载入示例数据</el-button></span>
      <span>没有排名列、没有总分列也能分析，名次由系统自动计算</span>
    </footer>
  </div>
</template>

