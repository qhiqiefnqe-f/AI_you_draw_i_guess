<script setup>
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useStore } from '@/store'

const store = useStore()

// 监听页面可见性变化
const handleVisibilityChange = () => {
  if (document.hidden) {
    // 页面隐藏时的处理
    console.log('页面隐藏')
  } else {
    // 页面显示时的处理
    console.log('页面显示')
    if (store.socketConnected) {
      // 重新获取房间列表等
      store.getRoomList().catch(console.error)
    }
  }
}

// 监听网络状态变化
const handleOnline = () => {
  console.log('网络已连接')
  if (store.username && !store.socketConnected) {
    // 尝试重新连接
    store.connect(store.username).catch(console.error)
  }
}

const handleOffline = () => {
  console.log('网络已断开')
  store.setError('网络连接已断开')
}

// 组件挂载时绑定事件
onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

// 组件卸载时清理事件（不再主动断开socket）
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- 全局加载指示器 -->
    <div 
      v-if="store.loading" 
      class="fixed top-0 left-0 w-full h-1 bg-blue-500 z-50"
      style="animation: loading 2s ease-in-out infinite"
    ></div>
    
    <!-- 路由视图 -->
    <RouterView />
    
    <!-- 全局错误提示（备用，各页面有自己的错误处理） -->
    <div 
      v-if="store.error && !$route.meta?.hasErrorHandler" 
      class="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-50 max-w-sm"
    >
      <div class="flex items-start">
        <svg class="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
        </svg>
        <div class="flex-1">
          <p class="text-red-800 text-sm">{{ store.error }}</p>
        </div>
        <button 
          @click="store.clearError()" 
          class="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* 全局样式 */
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 加载动画 */
@keyframes loading {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 滚动条全局样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 焦点样式 */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* 选择文本样式 */
::selection {
  background-color: #3b82f6;
  color: white;
}

/* 禁用选择的元素 */
.no-select {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
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

/* 响应式工具类 */
@media (max-width: 640px) {
  .container {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

/* 打印样式 */
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
