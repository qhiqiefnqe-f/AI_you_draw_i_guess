<template>
  <div class="lobby-container min-h-screen bg-gray-50 p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 标题 -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">你画我猜</h1>
        <p class="text-gray-600">选择房间开始游戏</p>
      </div>

      <!-- 用户未连接时显示登录表单 -->
      <div v-if="!store.isReady" class="max-w-md mx-auto">
        <JoinForm @submit="handleJoin" :loading="store.loading" />
      </div>

      <!-- 用户已连接时显示房间列表 -->
      <div v-else class="space-y-6">
        <!-- 用户信息和操作 -->
        <div class="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {{ store.username.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="font-medium text-gray-800">{{ store.username }}</p>
              <p class="text-sm text-gray-500">已连接</p>
            </div>
          </div>
          <div class="flex space-x-2">
            <button 
              @click="createRoom" 
              :disabled="store.loading"
              class="btn-primary"
            >
              <span v-if="store.loading">创建中...</span>
              <span v-else>创建房间</span>
            </button>
            <button 
              @click="refreshRooms" 
              :disabled="store.loading"
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              刷新
            </button>
          </div>
        </div>

        <!-- 房间列表 -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-800 mb-4">房间列表</h2>
          
          <!-- 加载状态 -->
          <div v-if="store.loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p class="mt-2 text-gray-600">加载中...</p>
          </div>

          <!-- 空状态 -->
          <div v-else-if="store.rooms.length === 0" class="text-center py-8">
            <div class="text-gray-400 mb-4">
              <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <p class="text-gray-600 mb-4">暂无房间</p>
            <button @click="createRoom" class="btn-primary">
              创建第一个房间
            </button>
          </div>

          <!-- 房间卡片列表 -->
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="room in store.rooms" 
              :key="room.id"
              class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
              @click="joinRoom(room.id)"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="font-semibold text-gray-800">{{ room.name || room.id }}</h3>
                  <p class="text-sm text-gray-500">房间ID: {{ room.id }}</p>
                </div>
                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {{ room.count }} 人
                </span>
              </div>
              <div class="flex justify-between items-center">
                <div class="flex -space-x-2">
                  <!-- 显示前3个成员的头像 -->
                  <div 
                    v-for="i in Math.min(room.count, 3)" 
                    :key="i"
                    class="w-6 h-6 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-xs text-gray-600"
                  >
                    {{ i }}
                  </div>
                  <div 
                    v-if="room.count > 3"
                    class="w-6 h-6 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center text-xs text-gray-500"
                  >
                    +{{ room.count - 3 }}
                  </div>
                </div>
                <button 
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  @click.stop="joinRoom(room.id)"
                >
                  加入
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="store.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-red-800">{{ store.error }}</p>
            <button 
              @click="store.clearError()" 
              class="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '@/store'
import JoinForm from '@/components/JoinForm.vue'

const router = useRouter()
const store = useStore()

// 处理用户登录
const handleJoin = async ({ username, roomId }) => {
  try {
    console.log('[Lobby] handleJoin called:', { username, roomId })
    console.log('[Lobby] before connect, isReady:', store.isReady, 'socketConnected:', store.socketConnected)
    await store.connect(username)
    console.log('[Lobby] connect resolved, isReady:', store.isReady, 'socketConnected:', store.socketConnected, 'username:', store.username)
    
    if (roomId) {
      // 如果指定了房间ID，直接加入
      console.log('[Lobby] attempting joinRoom with roomId:', roomId)
      await joinRoom(roomId)
    } else {
      // 否则刷新房间列表
      console.log('[Lobby] no roomId, refreshing rooms')
      await refreshRooms()
    }
  } catch (error) {
    console.error('连接失败:', error)
    store.setError('连接失败，请重试')
  }
}

// 创建房间
const createRoom = async () => {
  try {
    console.log('[Lobby] createRoom clicked')
    const roomId = store.generateRoomId()
    console.log('[Lobby] generated roomId:', roomId)
    await store.createAndJoinRoom(roomId)
    console.log('[Lobby] after createAndJoinRoom, currentRoom:', store.currentRoom)
    await router.push(`/room/${roomId}`)
    console.log('[Lobby] router.push resolved -> /room/' + roomId)
  } catch (error) {
    console.error('创建房间失败:', error)
    store.setError('创建房间失败，请重试')
  }
}

// 加入房间
const joinRoom = async (roomId) => {
  try {
    console.log('[Lobby] joinRoom called with roomId:', roomId)
    await store.joinRoom(roomId)
    console.log('[Lobby] after store.joinRoom, currentRoom:', store.currentRoom)
    await router.push(`/room/${roomId}`)
    console.log('[Lobby] router.push resolved -> /room/' + roomId)
  } catch (error) {
    console.error('加入房间失败:', error)
    store.setError('加入房间失败，请重试')
  }
}

// 刷新房间列表
const refreshRooms = async () => {
  try {
    console.log('[Lobby] refreshRooms called')
    await store.getRoomList()
    console.log('[Lobby] rooms after refresh:', store.rooms)
  } catch (error) {
    console.error('获取房间列表失败:', error)
    store.setError('获取房间列表失败，请重试')
  }
}

// 组件挂载时的处理
onMounted(() => {
  console.log('[Lobby] mounted, isReady:', store.isReady, 'socketConnected:', store.socketConnected, 'username:', store.username)
  // 如果已经连接，获取房间列表
  if (store.isReady) {
    refreshRooms()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  console.log('[Lobby] unmounted, clearing error')
  store.clearError()
})
</script>

<style scoped>
/* 组件特定样式 */
.lobby-container {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card:hover {
  transform: translateY(-2px);
}
</style>