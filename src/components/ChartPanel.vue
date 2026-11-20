<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadECharts } from '../lib/echarts'

const props = withDefaults(defineProps<{ option: Record<string, unknown>; height?: number }>(), {
  height: 300,
})

const container = ref<HTMLDivElement>()
let chart: import('echarts/core').ECharts | null = null
let disposed = false

const resize = () => chart?.resize()

onMounted(async () => {
  const echarts = await loadECharts()
  if (!container.value || disposed) return
  chart = echarts.init(container.value, undefined, { renderer: 'canvas' })
  chart.setOption(props.option)
  window.addEventListener('resize', resize)
})

watch(
  () => props.option,
  (option) => {
    chart?.setOption(option, true)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="container" class="chart-canvas" :style="{ height: `${height}px` }" />
</template>
