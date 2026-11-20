<script setup lang="ts">
withDefaults(defineProps<{ title?: string; dense?: boolean }>(), {
  title: '',
  dense: false,
})
</script>

<template>
  <section class="panel-box" :class="{ dense }">
    <i class="corner tl" />
    <i class="corner tr" />
    <i class="corner bl" />
    <i class="corner br" />
    <header v-if="title || $slots.extra" class="panel-box-head">
      <span class="panel-box-title">
        <slot name="icon" />
        {{ title }}
      </span>
      <span class="panel-box-extra"><slot name="extra" /></span>
    </header>
    <div class="panel-box-body">
      <slot />
    </div>
  </section>
</template>
