<template>
  <div class="chat-panel">
    <!-- 聊天历史（固定高度，可滚动） -->
    <div class="chat-history-container">
      <ChatWindow :messages="messages" />
    </div>

    <!-- 输入与发送 -->
    <form @submit.prevent="onSubmit" class="chat-input-row">
      <input
        v-model="text"
        type="text"
        placeholder="输入消息…"
        :disabled="disabled"
        :maxlength="500"
        class="chat-input"
        @keydown.enter.prevent="onSubmit"
      />
      <button
        type="submit"
        :disabled="disabled || !text.trim()"
        class="send-button"
      >
        发送
      </button>
    </form>
    <div class="char-counter">
      <span :class="text.length > 450 ? 'warn' : 'muted'">{{ text.length }}/500</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ChatWindow from '@/components/ChatWindow.vue'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send'])
const text = ref('')

const onSubmit = () => {
  const payload = text.value.trim()
  if (!payload || props.disabled) return
  emit('send', payload)
  text.value = ''
}
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-history-container {
  height: 16rem; /* 固定高度：h-64 */
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.chat-input-row {
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
}

.chat-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}

.send-button {
  padding: 8px 14px;
  border-radius: 8px;
  background-color: #3b82f6;
  color: #fff;
  font-size: 14px;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.char-counter {
  text-align: right;
  font-size: 12px;
}
.char-counter .muted { color: #9ca3af; }
.char-counter .warn { color: #ef4444; }
</style>