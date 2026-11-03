<script setup lang="ts">
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  hasData: { type: Boolean, default: false }
});
defineEmits(['retry']);
</script>

<template>
  <div v-if="error" class="load-feedback error" role="alert">
    <span>{{ error.message || 'Không tải được dữ liệu. Vui lòng thử lại.' }}</span>
    <button type="button" @click="$emit('retry')">Thử lại</button>
  </div>
  <p v-else-if="loading && !hasData" class="load-feedback" role="status" aria-live="polite">Đang tải dữ liệu…</p>
</template>

<style scoped>
.load-feedback {
  margin: 16px;
  color: var(--muted);
  font-size: 14px;
  line-height: 20px;
}
.load-feedback.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--err-bg);
  color: var(--err-ink);
}
.load-feedback button {
  flex: none;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid currentColor;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
