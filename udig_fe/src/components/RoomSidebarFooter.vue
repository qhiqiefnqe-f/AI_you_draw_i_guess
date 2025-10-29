<template>
  <div class="sidebar-footer flex items-center justify-between">
    <button class="btn-secondary" @click="copyId">
      复制房间号
    </button>
    <button class="btn-danger" @click="$emit('exit')">
      退出房间
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  roomId: {
    type: [String, Number],
    default: ''
  }
})

const copied = ref(false)

const copyId = async () => {
  try {
    await navigator.clipboard.writeText(String(props.roomId || ''))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (err) {
    // 兼容不支持 clipboard 的环境
    const textarea = document.createElement('textarea')
    textarea.value = String(props.roomId || '')
    document.body.appendChild(textarea)
    textarea.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<style scoped>
.sidebar-footer { gap: 8px; }

.btn-secondary {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #374151;
  background: #fff;
}
.btn-secondary:hover { background: #f9fafb; }

.btn-danger {
  padding: 8px 12px;
  border-radius: 8px;
  background: #ef4444;
  color: #fff;
}
.btn-danger:hover { background: #dc2626; }

/* 复制提示（可选：用 title 或其他提示展示） */
</style>