<template>
  <div class="sidebar-header flex items-center justify-between">
    <div>
      <h3 class="text-sm font-semibold text-gray-800">房间信息</h3>
      <p class="text-xs text-blue-600 mt-1">房间ID：<span class="font-mono">{{ roomId }}</span></p>
      <p class="text-xs text-gray-600 mt-1">
        房主：
        <span v-if="owner" class="font-medium text-gray-800">
          {{ owner }}（房主👑）
        </span>
        <span v-else class="text-gray-400">未设置</span>
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
        在线：{{ memberCount }}
      </span>
      <!-- 房主配置按钮 -->
      <button 
        v-if="isOwner && !gameInProgress"
        @click="$emit('openConfig')"
        class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="房间配置"
      >
        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  roomId: {
    type: [String, Number],
    default: ''
  },
  owner: {
    type: String,
    default: ''
  },
  memberCount: {
    type: Number,
    default: 0
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  gameInProgress: {
    type: Boolean,
    default: false
  }
})

defineEmits(['openConfig'])
</script>

<style scoped>
.sidebar-header {
  /* 与 Lobby 的卡片风格保持一致的简约样式 */
}
</style>