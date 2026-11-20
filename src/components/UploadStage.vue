<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import type { ExamDraft, HistoryItem } from '../types'
import PanelBox from './PanelBox.vue'

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
        <h1>成绩单接入</h1>
        <p>至少 2 份，可一次多选；上传后确认字段，再选择对比场次。</p>
      </div>
      <el-button @click="emit('demo')">载入示例数据</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-16" />

    <div class="upload-layout">
      <div class="upload-left">
        <PanelBox title="上传成绩单" class="upload-panel">
          <template #extra>支持 .xlsx / .xlsm / .csv</template>
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
              <div class="el-upload__tip">第一次月考、第二次月考、期中考试……可以一起接入</div>
            </template>
          </el-upload>

          <div class="upload-actions">
            <span class="muted">
              {{ drafts.length ? `已接入 ${drafts.length} 份，至少需要 2 份` : '尚未接入成绩单' }}
            </span>
            <el-button type="primary" :disabled="drafts.length < 2" @click="emit('next')">
              下一步：确认字段
            </el-button>
          </div>
        </PanelBox>
      </div>

      <div class="upload-right">
        <PanelBox title="已接入场次" class="dense">
          <template #extra>{{ drafts.length }} 份</template>
          <el-table v-if="drafts.length" :data="drafts" size="small" height="300">
            <el-table-column type="index" label="#" width="46" />
            <el-table-column prop="label" label="考试名称" min-width="120" />
            <el-table-column label="科目" width="62" align="center">
              <template #default="{ row }">{{ row.config.subjectCols.length }}</template>
            </el-table-column>
            <el-table-column label="操作" width="66" align="right">
              <template #default="{ row }">
                <el-button link type="danger" @click="emit('remove', row.id)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="upload-tips">
            <p><b>01</b> 拖入第一次月考成绩单</p>
            <p><b>02</b> 再拖入第二次月考 / 期中成绩单</p>
            <p><b>03</b> 点击“下一步”确认表头与科目列</p>
          </div>
        </PanelBox>

        <PanelBox v-if="history.length" title="最近分析" class="dense">
          <div v-for="item in history" :key="item.id" class="history-row">
            <div>
              <strong>{{ item.title }}</strong>
              <span class="muted">{{ item.labels.join(' → ') }}</span>
            </div>
            <div class="row-gap">
              <el-button size="small" @click="emit('restore', item)">恢复</el-button>
              <el-button size="small" link type="danger" @click="emit('removeHistory', item.id)">
                删除
              </el-button>
            </div>
          </div>
        </PanelBox>

        <PanelBox v-else title="接入提示" class="dense">
          <div class="upload-tips">
            <p><b>隐私</b> 所有解析在本机浏览器完成，成绩不上传服务器</p>
            <p><b>格式</b> 表头可不在第一行，系统会自动定位</p>
            <p><b>科目</b> 自动识别数值列，可在下一步手动勾选</p>
          </div>
        </PanelBox>
      </div>
    </div>
  </div>
</template>

