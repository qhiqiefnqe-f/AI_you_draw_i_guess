<template>
  <div class="join-form">
    <div class="form-container">
      <div class="form-header">
        <h1 class="form-title">You Draw I Guess</h1>
        <p class="form-subtitle">输入昵称开始游戏</p>
      </div>
      
      <form @submit.prevent="handleSubmit" class="form-content">
        <!-- 用户名输入 -->
        <div class="form-group">
          <label for="username" class="form-label">昵称</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            class="form-input"
            :class="{ 'error': errors.username }"
            placeholder="请输入昵称（最多20字符）"
            maxlength="20"
            required
            :disabled="loading"
          />
          <div v-if="errors.username" class="error-message">
            {{ errors.username }}
          </div>
        </div>
        
        <!-- 房间ID输入 -->
        <div class="form-group">
          <label for="roomId" class="form-label">房间号（可选）</label>
          <input
            id="roomId"
            v-model="formData.roomId"
            type="text"
            class="form-input"
            :class="{ 'error': errors.roomId }"
            placeholder="留空将创建新房间"
            :disabled="loading"
          />
          <div v-if="errors.roomId" class="error-message">
            {{ errors.roomId }}
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="form-actions">
          <button
            type="submit"
            class="btn-primary"
            :disabled="loading || !isFormValid"
          >
            <span v-if="loading" class="loading-spinner"></span>
            {{ loading ? '连接中...' : (formData.roomId ? '加入房间' : '创建房间') }}
          </button>
          
          <button
            v-if="!formData.roomId"
            type="button"
            @click="generateRandomRoom"
            class="btn-secondary"
            :disabled="loading"
          >
            随机房间号
          </button>
        </div>
        
        <!-- 错误提示 -->
        <div v-if="generalError" class="general-error">
          {{ generalError }}
        </div>
      </form>
      
      <!-- 最近使用的用户名 -->
      <div v-if="recentUsernames.length > 0" class="recent-usernames">
        <p class="recent-title">最近使用的昵称：</p>
        <div class="recent-list">
          <button
            v-for="username in recentUsernames"
            :key="username"
            @click="selectUsername(username)"
            class="recent-item"
            :disabled="loading"
          >
            {{ username }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '@/store'

// Emits
const emit = defineEmits(['submit', 'error'])

// Store
const store = useStore()

// Refs
const loading = ref(false)
const formData = ref({
  username: '',
  roomId: ''
})
const errors = ref({
  username: '',
  roomId: ''
})
const generalError = ref('')
const recentUsernames = ref([])

// Computed
const isFormValid = computed(() => {
  return formData.value.username.trim().length > 0 && 
         formData.value.username.trim().length <= 20 &&
         !errors.value.username &&
         !errors.value.roomId
})

// Methods
const validateUsername = (username) => {
  if (!username || username.trim().length === 0) {
    return '昵称不能为空'
  }
  
  if (username.trim().length > 20) {
    return '昵称不能超过20个字符'
  }
  
  // 检查特殊字符
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+$/.test(username.trim())) {
    return '昵称只能包含中文、英文、数字、下划线和连字符'
  }
  
  return ''
}

const validateRoomId = (roomId) => {
  if (!roomId || roomId.trim().length === 0) {
    return '' // 房间ID可选
  }
  
  if (roomId.trim().length > 50) {
    return '房间号不能超过50个字符'
  }
  
  // 检查房间ID格式
  if (!/^[a-zA-Z0-9_\-]+$/.test(roomId.trim())) {
    return '房间号只能包含英文、数字、下划线和连字符'
  }
  
  return ''
}

const validateForm = () => {
  errors.value.username = validateUsername(formData.value.username)
  errors.value.roomId = validateRoomId(formData.value.roomId)
  generalError.value = ''
  
  return !errors.value.username && !errors.value.roomId
}

const generateRandomRoom = () => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 5)
  formData.value.roomId = `room_${timestamp}_${random}`
}

const selectUsername = (username) => {
  formData.value.username = username
  errors.value.username = ''
}

const saveRecentUsername = (username) => {
  const recent = getRecentUsernames()
  const filtered = recent.filter(name => name !== username)
  const updated = [username, ...filtered].slice(0, 5) // 保留最近5个
  
  localStorage.setItem('recentUsernames', JSON.stringify(updated))
  recentUsernames.value = updated
}

const getRecentUsernames = () => {
  try {
    const stored = localStorage.getItem('recentUsernames')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load recent usernames:', error)
    return []
  }
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }
  
  loading.value = true
  generalError.value = ''
  
  try {
    const username = formData.value.username.trim()
    const roomId = formData.value.roomId.trim() || store.generateRoomId()
    
    // 保存最近使用的用户名
    saveRecentUsername(username)
    
    // 发送提交事件
    console.log('[JoinForm] emit submit:', { username, roomId })
    emit('submit', {
      username,
      roomId
    })
    
  } catch (error) {
    console.error('Form submission error:', error)
    generalError.value = error.message || '提交失败，请重试'
    emit('error', error)
  } finally {
    loading.value = false
  }
}

// 监听输入变化，实时验证
const handleUsernameInput = () => {
  if (formData.value.username) {
    errors.value.username = validateUsername(formData.value.username)
  }
}

const handleRoomIdInput = () => {
  if (formData.value.roomId) {
    errors.value.roomId = validateRoomId(formData.value.roomId)
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 加载最近使用的用户名
  recentUsernames.value = getRecentUsernames()
  
  // 如果store中有用户名，自动填充
  if (store.username) {
    formData.value.username = store.username
  }
})

// 暴露方法给父组件
defineExpose({
  setLoading: (value) => { loading.value = value },
  setError: (error) => { generalError.value = error },
  clearError: () => { generalError.value = '' }
})
</script>

<style scoped>
.join-form {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.form-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-title {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.form-subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-input {
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;
  background-color: #ffffff;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.error {
  border-color: #ef4444;
}

.form-input:disabled {
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.error-message {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 14px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.general-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.recent-usernames {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.recent-title {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 8px 0;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recent-item {
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  color: #374151;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recent-item:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.recent-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .join-form {
    padding: 16px;
  }
  
  .form-container {
    padding: 24px;
  }
  
  .form-title {
    font-size: 24px;
  }
  
  .form-subtitle {
    font-size: 14px;
  }
  
  .form-input {
    font-size: 16px; /* 防止iOS缩放 */
  }
}
</style>