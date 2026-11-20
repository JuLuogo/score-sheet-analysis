<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ width?: number; height?: number }>(), {
  width: 1920,
  height: 1080,
})

const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

const resize = () => {
  const sx = window.innerWidth / props.width
  const sy = window.innerHeight / props.height
  const next = Math.min(sx, sy)
  scale.value = next
  offsetX.value = (window.innerWidth - props.width * next) / 2
  offsetY.value = (window.innerHeight - props.height * next) / 2
}

const style = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  transformOrigin: 'top left',
}))

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<template>
  <div class="scale-screen">
    <div class="scale-canvas" :style="style">
      <slot />
    </div>
  </div>
</template>
