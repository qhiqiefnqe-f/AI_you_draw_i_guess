<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <!-- 对话框头部 -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">房间配置</h2>
        <button @click="$emit('close')" class="p-2 hover:bg-gray-100 rounded-lg">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 配置内容 -->
      <div class="p-6 space-y-6">
        <!-- 基础设置 -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-800">基础设置</h3>
          
          <!-- 玩家人数限制 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">最少玩家数</label>
              <select v-model="localConfig.minPlayers" class="w-full p-2 border border-gray-300 rounded-lg">
                <option value="3">3人</option>
                <option value="4">4人</option>
                <option value="5">5人</option>
                <option value="6">6人</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">最多玩家数</label>
              <select v-model="localConfig.maxPlayers" class="w-full p-2 border border-gray-300 rounded-lg">
                <option value="6">6人</option>
                <option value="8">8人</option>
                <option value="10">10人</option>
                <option value="12">12人</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 时间设置 -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-800">时间设置</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">绘画时间</label>
              <select v-model="localConfig.drawingTime" class="w-full p-2 border border-gray-300 rounded-lg">
                <option value="30">30秒</option>
                <option value="60">60秒</option>
                <option value="90">90秒</option>
                <option value="120">120秒</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">描述时间</label>
              <select v-model="localConfig.descriptionTime" class="w-full p-2 border border-gray-300 rounded-lg">
                <option value="30">30秒</option>
                <option value="60">60秒</option>
                <option value="90">90秒</option>
                <option value="120">120秒</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 游戏模式设置 -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-800">游戏模式</h3>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">奇数人数结尾策略</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input 
                  type="radio" 
                  name="oddEndStrategy" 
                  value="n-1" 
                  v-model="localConfig.oddEndStrategy"
                  class="mr-2"
                >
                <span class="text-sm">跳过最后一步（n-1步）</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="radio" 
                  name="oddEndStrategy" 
                  value="full" 
                  v-model="localConfig.oddEndStrategy"
                  class="mr-2"
                >
                <span class="text-sm">完整传话链（n步）</span>
              </label>
            </div>
            <p class="text-xs text-gray-500 mt-1">确保传话链以描述结尾</p>
          </div>
        </div>

        <!-- 词库设置 -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-800">词库设置</h3>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">词库类型</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input 
                  type="radio" 
                  v-model="localConfig.wordLibraryType" 
                  value="system" 
                  class="mr-2"
                >
                <span class="text-sm">系统内置词库</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="radio" 
                  v-model="localConfig.wordLibraryType" 
                  value="custom" 
                  class="mr-2"
                  disabled
                >
                <span class="text-sm text-gray-400">自定义词库（暂未开放）</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="radio" 
                  v-model="localConfig.wordLibraryType" 
                  value="mixed" 
                  class="mr-2"
                  disabled
                >
                <span class="text-sm text-gray-400">混合词库（暂未开放）</span>
              </label>
            </div>
          </div>

          <!-- 系统内置词库选择 -->
          <div v-if="localConfig.wordLibraryType === 'system'" class="space-y-3">
            <label class="block text-sm font-medium text-gray-700">选择词库分类</label>
            
            <!-- 加载状态 -->
            <div v-if="loadingLibraries" class="flex items-center justify-center py-4">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span class="ml-2 text-sm text-gray-600">加载词库中...</span>
            </div>
            
            <!-- 词库列表 -->
            <div v-else-if="availableLibraries.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              <label 
                v-for="library in availableLibraries" 
                :key="library.id"
                class="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
              >
                <input 
                  type="checkbox" 
                  :value="library.id"
                  v-model="localConfig.selectedLibraries"
                  class="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                >
                <div class="flex items-center flex-1">
                  <span class="text-lg mr-2">{{ library.icon }}</span>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">{{ library.name }}</div>
                    <div class="text-xs text-gray-500">{{ library.description }} ({{ library.wordCount }}个词汇)</div>
                  </div>
                </div>
              </label>
            </div>
            
            <!-- 错误状态 -->
            <div v-else-if="libraryError" class="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {{ libraryError }}
            </div>
            
            <!-- 已选择的词库显示 -->
            <div v-if="selectedLibrariesDisplay.length > 0" class="mt-3">
              <div class="text-sm font-medium text-gray-700 mb-2">已选择的词库：</div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="library in selectedLibrariesDisplay" 
                  :key="library.id"
                  class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  <span class="mr-1">{{ library.icon }}</span>
                  {{ library.name }}
                  <button 
                    @click="removeSelectedLibrary(library.id)"
                    class="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                共选择了 {{ selectedLibrariesDisplay.length }} 个词库，包含约 {{ totalSelectedWords }} 个词汇
              </div>
            </div>
            
            <!-- 未选择提示 -->
            <div v-else class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              请至少选择一个词库分类
            </div>
          </div>

          <div>
            <label class="flex items-center">
              <input 
                type="checkbox" 
                v-model="localConfig.allowCustomPrompts" 
                class="mr-2"
                disabled
              >
              <span class="text-sm text-gray-400">允许自定义初始题目（暂未开放）</span>
            </label>
          </div>
        </div>

        <!-- 其他设置 -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-gray-800">其他设置</h3>
          
          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                v-model="localConfig.allowObservers" 
                class="mr-2"
                disabled
              >
              <span class="text-sm text-gray-400">允许观众模式（暂未开放）</span>
            </label>
            
            <label class="flex items-center">
              <input 
                type="checkbox" 
                v-model="localConfig.enableContentFilter" 
                class="mr-2"
                disabled
              >
              <span class="text-sm text-gray-400">启用内容过滤（暂未开放）</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
        <button 
          @click="$emit('close')" 
          class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button 
          @click="saveConfig" 
          class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          保存配置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'save'])

// 默认配置
const defaultConfig = {
  minPlayers: 3,
  maxPlayers: 12,
  drawingTime: 60,
  descriptionTime: 60,
  oddEndStrategy: 'n-1',
  wordLibraryType: 'system',
  selectedLibraries: ['animals', 'fruits'], // 默认选择动物和水果词库
  allowCustomPrompts: false,
  allowObservers: false,
  enableContentFilter: false
}

// 当前配置
const localConfig = ref({ ...defaultConfig })

// 词库相关状态
const availableLibraries = ref([])
const loadingLibraries = ref(false)
const libraryError = ref('')

// 监听配置变化
watch(() => props.config, (newConfig) => {
  localConfig.value = { ...defaultConfig, ...newConfig }
}, { immediate: true })

// 计算属性：已选择的词库显示信息
const selectedLibrariesDisplay = computed(() => {
  return availableLibraries.value.filter(lib => 
    localConfig.value.selectedLibraries?.includes(lib.id)
  )
})

// 计算属性：已选择词库的总词汇数
const totalSelectedWords = computed(() => {
  return selectedLibrariesDisplay.value.reduce((total, lib) => total + lib.wordCount, 0)
})

// 获取可用词库列表
const fetchAvailableLibraries = async () => {
  loadingLibraries.value = true
  libraryError.value = ''
  
  try {
    const response = await fetch('/api/word-libraries')
    const result = await response.json()
    
    if (result.success) {
      availableLibraries.value = result.data
    } else {
      libraryError.value = result.message || '获取词库列表失败'
    }
  } catch (error) {
    console.error('获取词库列表失败:', error)
    libraryError.value = '网络错误，请稍后重试'
  } finally {
    loadingLibraries.value = false
  }
}

// 移除已选择的词库
const removeSelectedLibrary = (libraryId) => {
  const index = localConfig.value.selectedLibraries.indexOf(libraryId)
  if (index > -1) {
    localConfig.value.selectedLibraries.splice(index, 1)
  }
}

// 监听词库类型变化，自动获取词库列表
watch(() => localConfig.value.wordLibraryType, (newType) => {
  if (newType === 'system' && availableLibraries.value.length === 0) {
    fetchAvailableLibraries()
  }
})

// 组件挂载时获取词库列表（如果默认选择了系统词库）
onMounted(() => {
  if (localConfig.value.wordLibraryType === 'system') {
    fetchAvailableLibraries()
  }
})

// 保存配置
function saveConfig() {
  emit('save', { ...localConfig.value })
}
</script>

<style scoped>
/* 对话框动画可以在这里添加 */
</style>