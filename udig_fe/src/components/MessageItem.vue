<template>
  <div 
    :class="[
      'message-item',
      message.type === 'system' ? 'system-message' : 'chat-message'
    ]"
  >
    <!-- 系统消息 -->
    <div v-if="message.type === 'system'" class="system-content">
      <span class="system-text">{{ message.text }}</span>
      <span class="message-time">{{ formatTime(message.time) }}</span>
    </div>
    
    <!-- 聊天消息 -->
    <div v-else class="chat-content" :class="{ 'own': isOwnMessage }">
      <div class="message-header" :class="{ 'own': isOwnMessage }">
        <span class="username" :class="{ 'own-message': isOwnMessage }">
          {{ displayName }}
        </span>
        <span class="message-time">{{ formatTime(message.time) }}</span>
      </div>
      <div class="message-text" :class="{ 'own-message': isOwnMessage }">
        {{ message.text }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '@/store'

// Props
const props = defineProps({
  message: {
    type: Object,
    required: true,
    validator: (message) => {
      return message && 
             typeof message.from === 'string' && 
             typeof message.text === 'string' && 
             typeof message.time === 'number' &&
             ['chat', 'system'].includes(message.type)
    }
  }
})

// Store
const store = useStore()

// Computed
// 优先使用 fromId 判断是否为自己的消息；兼容旧结构回退到用户名
const isOwnMessage = computed(() => {
  if (props.message.type !== 'chat') return false
  return props.message.fromId ? props.message.fromId === store.userId : props.message.from === store.username
})

// 由房主ID映射房主昵称
const ownerName = computed(() => {
  const id = store.roomOwner
  const m = store.members.find(m => m.id === id)
  return m?.name || ''
})

// 优先使用 fromId 判断是否房主发送；兼容旧结构回退到昵称比对
const isOwnerSender = computed(() => {
  if (props.message.type !== 'chat') return false
  return props.message.fromId ? props.message.fromId === store.roomOwner : (ownerName.value && props.message.from === ownerName.value)
})

const displayName = computed(() => {
  if (props.message.type !== 'chat') return 'System'
  return isOwnerSender.value ? `${props.message.from}（房主👑）` : props.message.from
})

// Methods
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}
</script>

<style scoped>
.message-item {
  margin-bottom: 8px;
  word-wrap: break-word;
}

/* 系统消息样式 */
.system-message {
  text-align: center;
}

.system-content {
  background-color: #f3f4f6;
  border-radius: 12px;
  padding: 6px 12px;
  display: inline-block;
  max-width: 80%;
}

.system-text {
  font-size: 13px;
  color: #6b7280;
  margin-right: 8px;
}

/* 聊天消息样式 */
.chat-message {
  text-align: left;
}

/* 容器控制对齐：默认靠左，自己消息靠右 */
.chat-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.chat-content.own {
  align-items: flex-end;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-header.own .username {
  color: #111827;
}

.username {
  font-weight: 500;
  color: #374151;
}

.username.own-message {
  color: #2563eb;
}

.message-time {
  font-size: 12px;
  color: #9ca3af;
}

.message-text {
  margin-top: 4px;
  max-width: 80%;
  line-height: 1.6;
  background-color: #f9fafb;
  border-radius: 12px;
  padding: 8px 12px;
}

.message-text.own-message {
  background-color: #eff6ff;
}
</style>