<template>
  <div class="chat-window">
    <div 
      ref="messagesContainer"
      class="messages-container"
      @scroll="handleScroll"
    >
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <p class="empty-text">暂无消息，开始聊天吧！</p>
      </div>
      
      <div v-else class="messages-list">
        <MessageItem 
          v-for="message in messages" 
          :key="message.id || `${message.time}-${message.fromId || message.from}`"
          :message="message"
        />
      </div>
      
      <!-- 滚动到底部按钮 -->
      <Transition name="fade">
        <button 
          v-if="showScrollButton"
          @click="scrollToBottom"
          class="scroll-to-bottom"
          title="滚动到底部"
        >
          ↓
        </button>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import MessageItem from './MessageItem.vue'

// Props
const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  autoScroll: {
    type: Boolean,
    default: true
  }
})

// Refs
const messagesContainer = ref(null)
const showScrollButton = ref(false)
const isUserScrolling = ref(false)
const scrollTimeout = ref(null)

// Methods
const scrollToBottom = (smooth = true) => {
  if (!messagesContainer.value) return
  
  const container = messagesContainer.value
  const scrollOptions = {
    top: container.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant'
  }
  
  container.scrollTo(scrollOptions)
  showScrollButton.value = false
}

const handleScroll = () => {
  if (!messagesContainer.value) return
  
  const container = messagesContainer.value
  const { scrollTop, scrollHeight, clientHeight } = container
  
  // 判断是否接近底部（允许10px的误差）
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 10
  
  // 显示/隐藏滚动按钮
  showScrollButton.value = !isNearBottom && props.messages.length > 0
  
  // 标记用户正在滚动
  isUserScrolling.value = true
  
  // 清除之前的定时器
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  
  // 500ms后认为用户停止滚动
  scrollTimeout.value = setTimeout(() => {
    isUserScrolling.value = false
  }, 500)
}

const checkShouldAutoScroll = () => {
  if (!messagesContainer.value || !props.autoScroll) return false
  
  const container = messagesContainer.value
  const { scrollTop, scrollHeight, clientHeight } = container
  
  // 如果用户正在滚动，不自动滚动
  if (isUserScrolling.value) return false
  
  // 如果已经在底部附近，自动滚动
  return scrollHeight - scrollTop - clientHeight < 50
}

// 监听消息变化，自动滚动到底部
watch(() => props.messages, async (newMessages, oldMessages) => {
  if (!newMessages || newMessages.length === 0) return
  
  // 如果是新消息且应该自动滚动
  if (newMessages.length > (oldMessages?.length || 0) && checkShouldAutoScroll()) {
    await nextTick()
    scrollToBottom(true)
  }
}, { deep: true })

// 组件挂载后滚动到底部
onMounted(async () => {
  await nextTick()
  if (props.messages.length > 0) {
    scrollToBottom(false) // 初始加载不使用动画
  }
})

// 清理定时器
onUnmounted(() => {
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
})

// 暴露方法给父组件
defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.chat-window {
  position: relative;
  height: 100%;
  background-color: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}

.messages-container {
  height: 100%;
  max-height: 60vh;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}

/* 自定义滚动条 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin: 0;
}

/* 消息列表 */
.messages-list {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* 滚动到底部按钮 */
.scroll-to-bottom {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  z-index: 10;
}

.scroll-to-bottom:hover {
  background-color: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.scroll-to-bottom:active {
  transform: translateY(0);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .messages-container {
    padding: 12px;
    max-height: 50vh;
  }
  
  .scroll-to-bottom {
    width: 36px;
    height: 36px;
    bottom: 16px;
    right: 16px;
    font-size: 16px;
  }
  
  .empty-state {
    height: 150px;
  }
  
  .empty-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }
}
</style>