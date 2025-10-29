<template>
  <div class="room-container h-screen bg-gray-50 flex flex-col overflow-hidden">
    

    <!-- 主要内容区域 -->
    <main class="flex-1 flex overflow-hidden min-h-0">
      <!-- 左侧游戏区域留白 -->
      <div class="flex-1 min-w-0 p-4">
        <div class="h-full border-2 border-dashed border-gray-300 rounded-lg bg-white/50">
          <!-- 画布挂载区：填满虚线容器 -->
          <div ref="gameAreaRef" class="relative w-full h-full overflow-hidden">
            <TelephoneCanvas ref="canvasComp" v-if="canvasW > 0 && canvasH > 0" :width="canvasW" :height="canvasH" :controlsInside="true" :readonly="readonlyCanvas" />
            
            <!-- 游戏状态信息栏 -->
            <div class="absolute top-2 left-2 z-20 bg-white/90 border rounded px-3 py-1 text-sm shadow">
              <div class="flex items-center gap-3 text-xs">
                <span>阶段：<span class="font-mono">{{ store.telephone.phase }}</span></span>
                <span>步：<span class="font-mono">{{ store.telephone.stepIndex }}</span></span>
                <span v-if="!store.telephone.multiChain">执行者：<span class="font-mono">{{ assigneeName || '未指派' }}</span></span>
                <span v-if="store.telephone.multiChain">模式：<span class="font-mono text-blue-600">多链</span></span>
                <span v-if="store.telephone.multiChain && store.telephone.submissionStats">
                  提交：<span class="font-mono">{{ store.telephone.submissionStats.submissionCount }}/{{ store.telephone.submissionStats.totalPlayers }}</span>
                </span>
              </div>
            </div>
            
            <!-- 开始游戏按钮（仅房主可见，游戏未开始时） -->
            <div v-if="store.isOwner && store.telephone.phase === 'idle'" class="absolute inset-0 flex items-center justify-center z-20">
              <button class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg transition-colors text-lg" @click="startGame">
                开始游戏
              </button>
            </div>
            
            <!-- 非房主等待状态蒙版 -->
            <div v-if="!store.isOwner && store.telephone.phase === 'idle'" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <div class="text-white text-xl font-medium">等待房主开始游戏...</div>
            </div>
            

            
            <!-- 题目选择阶段：多链模式下所有人都可以选择题目 -->
            <div v-if="store.telephone.phase === 'topic-selection'" class="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-white/95 border rounded-lg shadow-lg p-6 max-w-4xl">
              <div class="text-center space-y-4">
                <div class="text-xl font-semibold text-gray-800">
                  {{ store.telephone.multiChain ? '请选择一个题目开始绘画' : '请选择一个题目开始绘画' }}
                </div>
                <div class="text-sm text-gray-600">剩余时间：{{ deadlineText }}</div>
                
                <!-- 多链模式下显示我的链信息 -->
                <div v-if="store.telephone.multiChain && store.telephone.myChainId" class="text-sm text-blue-600">
                  我的链：{{ store.telephone.myChainId }}
                </div>
                
                <!-- 题目选项按钮 -->
                <div v-if="topicOptions.length > 0" class="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    v-for="(topic, index) in topicOptions" 
                    :key="index"
                    class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg transition-colors min-w-[180px]"
                    @click="selectTopic(topic)"
                  >
                    {{ topic }}
                  </button>
                </div>
                
                <!-- 加载状态或已选择状态 -->
                <div v-else class="text-gray-500">
                  <div v-if="hasSelectedTopic">
                    已选择题目，等待其他玩家选择完毕...
                  </div>
                  <div v-else>
                    正在加载题目选项...
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 绘制阶段右上角题目提示 -->
            <div v-if="store.telephone.phase === 'drawing'" class="absolute top-2 right-2 z-20 bg-white/90 border rounded px-3 py-1 text-sm max-w-[300px] shadow" :class="{ 'top-20': store.isOwner }">
              <div class="text-gray-600">题目</div>
              <div class="font-medium">{{ getCurrentAnswer() || '空' }}</div>
              <div class="text-xs text-gray-500 mt-1">剩余时间：{{ deadlineText }}</div>
            </div>
            <!-- 绘制阶段提交按钮 -->
            <div v-if="store.telephone.phase === 'drawing'" class="absolute bottom-4 right-4 z-20">
              <button 
                v-if="canDraw && !hasSubmitted"
                class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg transition-colors"
                @click="submitDrawing"
              >
                提交画作
              </button>
              <div 
                v-else-if="hasSubmitted && store.telephone.multiChain"
                class="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium shadow-lg flex items-center gap-2"
              >
                <div class="loading-spinner w-4 h-4"></div>
                <span>等待其他玩家 ({{ store.telephone.submissionStats.submissionCount }}/{{ store.telephone.submissionStats.totalPlayers }})</span>
              </div>
            </div>
            <!-- 描述阶段：画布内显示上一阶段画作和描述输入框 -->
            <div v-if="store.telephone.phase === 'describing'" class="absolute inset-0 z-10 bg-white/95 flex flex-col p-4">
              <!-- 上一阶段画作展示区域 -->
              <div class="flex-1 flex flex-col items-center justify-center min-h-0">
                <div class="bg-white border rounded-lg shadow-lg p-4 max-w-full max-h-full overflow-hidden">
                  <div class="text-sm text-gray-600 mb-2 text-center">上一阶段画作</div>
                  <div class="flex items-center justify-center">
                    <img v-if="prevStepImageUrl" :src="prevStepImageUrl" class="max-w-full max-h-[400px] object-contain" alt="上一阶段画作" />
                    <div v-else class="p-8 text-gray-400 text-center">暂无图像或加载中</div>
                  </div>
                </div>
              </div>
              
              <!-- 描述输入区域 -->
              <div class="mt-4 bg-white border rounded-lg shadow-lg p-4">
                <div v-if="canDescribe || store.telephone.multiChain" class="space-y-3">
                  <div class="text-sm text-gray-600">
                    {{ store.telephone.multiChain ? '请根据上图进行描述：' : '请根据上图进行描述：' }}
                    <span v-if="store.telephone.multiChain && store.telephone.myAssigneeChainId" class="text-blue-600">
                      (处理链：{{ store.telephone.myAssigneeChainId }})
                    </span>
                  </div>
                  <textarea 
                    v-model="store.telephone.descDraft" 
                    class="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                    rows="4" 
                    placeholder="根据上图描述你看到的内容..."
                  ></textarea>
                  <div class="flex items-center justify-between">
                    <div class="text-sm text-gray-500">剩余时间：{{ deadlineText }}</div>
                    <button 
                      v-if="!hasSubmitted"
                      class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      @click="submitDesc"
                      :disabled="!store.telephone.descDraft.trim()"
                    >
                      提交描述
                    </button>
                    <div 
                      v-else-if="hasSubmitted && store.telephone.multiChain"
                      class="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium flex items-center gap-2"
                    >
                      <div class="loading-spinner w-4 h-4"></div>
                      <span>等待其他玩家 ({{ store.telephone.submissionStats.submissionCount }}/{{ store.telephone.submissionStats.totalPlayers }})</span>
                    </div>
                  </div>
                </div>
                <div v-else-if="!store.telephone.multiChain" class="text-center py-4">
                  <div class="text-lg font-medium text-gray-700">等待描述者：{{ assigneeName || '未指派' }}</div>
                  <div class="text-sm text-gray-500 mt-1">剩余时间：{{ deadlineText }}</div>
                </div>
              </div>
            </div>
            <!-- 只读遮罩与倒计时 -->
            <div v-if="store.telephone.phase === 'drawing' && readonlyCanvas && !store.telephone.multiChain" class="absolute inset-0 z-10 bg-black/30 flex flex-col items-center justify-center text-white">
              <div class="text-lg font-semibold">等待当前执行者：{{ assigneeName || '未指派' }}</div>
              <div class="mt-2 text-sm">剩余时间：{{ deadlineText }}</div>
            </div>

            <!-- 结果展示阶段：自动播放与投票 -->
            <div v-if="store.telephone.phase === 'result'" class="absolute inset-0 z-10 flex flex-col p-4 bg-white/95">
              <div class="flex-1 flex flex-col items-center justify-center min-h-0">
                <!-- 左上角原始题目或当前描述 -->
                <div class="absolute top-2 left-2 bg-white/90 border rounded px-3 py-1 text-sm shadow">
                  <div class="text-gray-600">{{ resultCaptionLabel }}</div>
                  <div class="font-medium max-w-[300px] break-words">{{ resultCaptionText || '—' }}</div>
                </div>
                <!-- 中间播放区域：当前画作 -->
                <div class="max-w-full max-h-full overflow-hidden border rounded bg-white shadow p-4">
                  <div class="text-sm text-gray-600 mb-2 text-center">
                    链 {{ currentResultChainId || '—' }} / 第 {{ resultStepDisplayIndex + 1 }} 步
                  </div>
                  <div class="flex items-center justify-center">
                    <canvas v-if="resultUseCanvas" ref="resultCanvasRef" width="900" height="550" class="max-w-[760px] max-h-[420px] border rounded shadow"></canvas>
                    <img v-else-if="resultImageUrl" :src="resultImageUrl" class="max-w-[760px] max-h-[420px] object-contain" alt="播放画作" />
                    <div v-else class="p-8 text-gray-400 text-center">播放中或无图像</div>
                  </div>
                </div>
                <!-- 下方描述文本 -->
                <div class="mt-4 bg-white border rounded shadow p-3 w-full max-w-3xl">
                  <div class="text-sm text-gray-600">描述</div>
                  <div class="font-medium break-words">{{ resultDescText || '—' }}</div>
                  <div v-if="resultDescAuthorName" class="text-xs text-gray-500 mt-1">由 {{ resultDescAuthorName }}</div>
                </div>
              </div>

              <!-- 投票面板 -->
              <div v-if="showVotePanel" class="absolute inset-0 flex items-center justify-center">
                <div class="bg-white/95 border rounded-lg shadow-lg p-6 w-[420px] text-center">
                  <div class="text-sm text-gray-500 mb-2">（{{ resultInitAnswer || '—' }}） -> （{{ resultFinalDesc || '—' }}）</div>
                  <div class="text-lg font-semibold mb-2">此链是否符合题目？</div>
                  <div class="flex items-center justify-center gap-4 mb-4">
                    <button class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded" @click="vote(true)">✅ 符合</button>
                    <button class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded" @click="vote(false)">❌ 不符合</button>
                  </div>
                  <div class="text-sm text-gray-600">投票进度</div>
                  <div class="mt-2 flex flex-wrap gap-2 justify-center">
                    <span v-for="m in store.members" :key="m.id" class="px-2 py-1 border rounded">
                      {{ m.name }}：
                      <span v-if="votesForCurrent[m.id] === true">✅</span>
                      <span v-else-if="votesForCurrent[m.id] === false">❌</span>
                      <span v-else>—</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧房间侧栏（可折叠） -->
      <aside
        class="relative bg-white border-l border-gray-200 flex-shrink-0 hidden lg:flex flex-col transition-all duration-300 h-full min-h-0"
        :class="isSidebarOpen ? 'w-96' : 'w-10'"
      >
        <!-- 折叠切换手柄 -->
        <button
          class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-12 bg-white border border-gray-300 rounded-l flex items-center justify-center shadow-sm hover:bg-gray-50"
          @click="toggleSidebar"
          :aria-label="isSidebarOpen ? '收起侧栏' : '展开侧栏'"
        >
          <svg v-if="isSidebarOpen" class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          <svg v-else class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </button>

        <!-- 侧栏内容 -->
         <div v-if="isSidebarOpen" class="flex-1 flex flex-col min-h-0">
           <div class="p-4 border-b border-gray-200">
             <RoomSidebarHeader 
               :room-id="roomId" 
               :owner="ownerName" 
               :member-count="store.members.length"
               :is-owner="store.isOwner"
               :game-in-progress="store.telephone.phase !== 'idle'"
               @openConfig="showConfigDialog = true"
             />
           </div>

          <!-- 滚动内容区域（除顶部房间信息外整体滚动） -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <div class="p-4">
              <ChatPanel :messages="visibleMessages" :disabled="!store.socketConnected || store.loading" @send="handleChatSend" />
            </div>

            <div class="p-4">
              <VoicePanel />
            </div>

            <!-- 成员列表区域 + 房主参与者顺序选择 -->
            <div class="px-4 pb-4 space-y-4">
              <MembersList :members="store.members" :collapsible="false" />

              <!-- 参与者顺序选择（房主可见） -->
              <div v-if="store.isOwner" class="p-3 bg-gray-50 border rounded">
                <div class="font-semibold mb-2">参与者顺序 (需偶数人数)</div>
                <div class="space-y-2">
                  <div v-for="(pid, idx) in orderIds" :key="pid" class="flex items-center gap-2">
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">{{ idx + 1 }}</span>
                    <span class="flex-1">{{ memberName(pid) }}</span>
                    <button class="px-2 py-1 bg-gray-200 rounded" @click="moveMember(idx, -1)" :disabled="idx===0">↑</button>
                    <button class="px-2 py-1 bg-gray-200 rounded" @click="moveMember(idx, 1)" :disabled="idx===orderIds.length-1">↓</button>
                    <button class="px-2 py-1 bg-red-600 text-white rounded" @click="removeMember(pid)">移除</button>
                  </div>
                </div>
                <div class="mt-3">
                  <div class="text-sm text-gray-600 mb-1">可添加成员：</div>
                  <div class="flex flex-wrap gap-2">
                    <button v-for="m in availableMembers" :key="m.id" class="px-2 py-1 bg-white border rounded hover:bg-gray-100" @click="addMember(m.id)">{{ m.name }}</button>
                  </div>
                  <div class="text-xs text-gray-500 mt-2">
                    当前人数：{{ orderIds.length }} {{ orderIds.length % 2 === 0 ? '(偶数✓)' : '(奇数，需要偶数人数)' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部功能菜单 -->
            <div class="border-t border-gray-200 p-4">
              <RoomSidebarFooter :room-id="roomId" @exit="leaveRoom" />
            </div>
          </div>
        </div>
      </aside>

      <!-- 移动端侧栏弹层 -->
      <div
        v-if="showMobileSidebar"
        class="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden"
        @click="showMobileSidebar = false"
      >
        <div class="absolute right-0 top-0 h-full w-80 bg-white transform transition-transform flex flex-col" @click.stop>
          <div class="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800">房间配置</h2>
            <button @click="showMobileSidebar = false" class="p-2 hover:bg-gray-100 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto">
             <div class="p-4 border-b border-gray-200">
               <RoomSidebarHeader 
                 :room-id="roomId" 
                 :owner="ownerName" 
                 :member-count="store.members.length"
                 :is-owner="store.isOwner"
                 :game-in-progress="store.telephone.phase !== 'idle'"
                 @openConfig="showConfigDialog = true"
               />
             </div>
            <div class="p-4 border-b border-gray-200">
              <ChatPanel :messages="visibleMessages" :disabled="!store.socketConnected || store.loading" @send="handleChatSend" />
            </div>
            <div class="p-4 border-b border-gray-200">
              <VoicePanel />
            </div>
            <div class="p-4">
              <MembersList :members="store.members" :collapsible="false" />
            </div>
            <div class="p-4 border-t border-gray-200">
              <RoomSidebarFooter :room-id="roomId" @exit="leaveRoom" />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 移动端底部工具栏 -->
    <div class="lg:hidden bg白 border-t border-gray-200 p-2">
      <button 
        @click="showMobileSidebar = true"
        class="w-full flex items-center justify-center space-x-2 py-2 text-gray-600 hover:text-gray-800"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
        </svg>
        <span>打开侧栏</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div 
      v-if="store.error" 
      class="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-40"
    >
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
        </svg>
        <p class="text-red-800 mr-4">{{ store.error }}</p>
        <button 
          @click="store.clearError()" 
          class="text-red-600 hover:text-red-800"
        >
          ×
        </button>
      </div>
    </div>

    <!-- 断线重连提示 -->
     <div 
       v-if="!store.socketConnected" 
       class="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-40"
     >
       <div class="flex items-center">
         <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500 mr-2"></div>
         <p class="text-yellow-800">连接已断开，正在尝试重连...</p>
       </div>
     </div>

     <!-- 房间配置对话框 -->
     <RoomConfigDialog 
       v-if="showConfigDialog"
       :show="showConfigDialog"
       :config="roomConfig"
       @close="showConfigDialog = false"
       @save="handleConfigSave"
     />
   </div>
 </template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from '@/store'
import socketManager from '@/plugins/socket.js'
import MembersList from '@/components/MembersList.vue'
import RoomSidebarHeader from '@/components/RoomSidebarHeader.vue'
import RoomConfigDialog from '@/components/RoomConfigDialog.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import RoomSidebarFooter from '@/components/RoomSidebarFooter.vue'
import VoicePanel from '@/components/VoicePanel.vue'
import TelephoneCanvas from '@/components/TelephoneCanvas.vue'

const route = useRoute()
const router = useRouter()
const store = useStore()

// 响应式数据
const isSidebarOpen = ref(true)
const showMobileSidebar = ref(false)
const roomId = ref(route.params.id)

// 房间配置相关
    const showConfigDialog = ref(false)
    const roomConfig = computed(() => store.roomConfig)

// 题目选择相关
const topicOptions = ref([])
const hasSelectedTopic = ref(false)

// 获取题目选项
const fetchTopicOptions = async () => {
  try {
    const config = store.roomConfig
    console.log('fetchTopicOptions config:', config)
    
    // 如果没有配置词库，使用默认词库
    let libraryIds = config.selectedLibraries
    if (!libraryIds || libraryIds.length === 0) {
      // 使用默认词库ID
      libraryIds = ['animals', 'fruits', 'foods']
    }
    
    const response = await fetch('/api/word-libraries/random', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        libraryIds: libraryIds,
        count: 3
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('fetchTopicOptions result:', result)
      if (result.success) {
        topicOptions.value = result.data.words
      }
    } else {
      console.error('获取题目选项失败，HTTP状态:', response.status)
    }
  } catch (error) {
    console.error('获取题目选项失败:', error)
  }
}

// 监听传话链阶段变化，在题目选择阶段获取题目选项
watch(() => store.telephone.phase, (newPhase) => {
  if (newPhase === 'topic-selection') {
    // 重置选择状态
    hasSelectedTopic.value = false
    topicOptions.value = []
    
    // 多链模式下所有人都需要获取题目选项，单链模式下只有第一个指派者获取
    if (store.telephone.multiChain) {
      // 多链模式：所有玩家都获取题目选项
      fetchTopicOptions()
    } else if (store.telephone.assigneeId === store.userId) {
      // 单链模式：只有指派者获取题目选项
      fetchTopicOptions()
    }
  } else if (newPhase === 'result') {
    // 进入结果阶段，初始化回放
    initResultPlayback()
  } else {
    // 非题目选择阶段，重置状态
    hasSelectedTopic.value = false
  }
})

// 选择题目
const selectTopic = (topic) => {
  if (store.telephone.multiChain) {
    // 多链模式：通过Socket.IO发送题目选择到后端
    const payload = {
      roomId: store.currentRoom,
      chainId: store.telephone.myChainId,
      topic: topic
    }
    console.log('[前端] 发送题目选择:', payload)
    
    socketManager.emit('telephone/select-topic', payload, (response) => {
      console.log('[前端] 题目选择响应:', response)
      if (response?.ok) {
        console.log('题目选择成功')
      }
    })
    
    // 本地更新状态
    if (store.telephone.myChainId && store.telephone.chains[store.telephone.myChainId]) {
      store.telephone.chains[store.telephone.myChainId].answer = topic
    }
    
    // 清空题目选项，显示等待状态
    topicOptions.value = []
    hasSelectedTopic.value = true
    console.log('已选择题目:', topic, '等待其他玩家选择完毕...')
  } else {
    // 单链模式：设置传话链答案
    store.telephone.answer = topic
    // 单链模式：调用telephoneNextStage来正确切换到绘画阶段
    store.telephoneNextStage()
  }
  // 清空题目选项
  topicOptions.value = []
}

// 获取当前答案（支持多链模式）
const getCurrentAnswer = () => {
  if (store.telephone.phase !== 'drawing') return ''
  const idx = Number(store.telephone.stepIndex) || 0
  const prevIndex = idx - 1
  if (prevIndex >= 0) {
    // 已有上一轮描述：无论是否为空都直接返回，避免回退到题目
    return currentPromptText.value ?? ''
  }
  // 首轮绘制：展示题目
  if (store.telephone.multiChain) {
    const chainId = store.telephone.myAssigneeChainId || store.telephone.myChainId
    if (!chainId) return ''
    const localAnswer = store.telephone.chains[chainId]?.answer
    if (localAnswer) return localAnswer
    // 若本地无答案，异步拉取；同步返回空
    fetchChainAnswer(chainId)
    return ''
  }
  return store.telephone.answer || ''
}

// 从后端获取链的答案
const fetchChainAnswer = async (chainId) => {
  if (!chainId || !store.currentRoom) return
  
  try {
    const response = await fetch(`/api/telephone/chain/${store.currentRoom}/${chainId}`)
    if (response.ok) {
      const result = await response.json()
      if (result.ok && result.answer && store.telephone.chains[chainId]) {
        // 仅在当前未设置答案时填充，避免覆盖上一轮描述
        if (!store.telephone.chains[chainId].answer) {
          store.telephone.chains[chainId].answer = result.answer
        }
      }
    }
  } catch (error) {
    console.error('获取链答案失败:', error)
  }
}

// 画布尺寸：跟随左侧容器尺寸
const gameAreaRef = ref(null)
const canvasComp = ref(null)
const canvasW = ref(0)
const canvasH = ref(0)

// 传话链派生
const assigneeName = computed(() => {
  const id = store.telephone.assigneeId
  const m = store.members.find(m => m.id === id)
  return m?.name || ''
})

// 判断是否为第一个指派者（题目选择者）
const isFirstAssignee = computed(() => {
  if (store.telephone.phase !== 'topic-selection') return false
  // 在题目选择阶段，第一个指派者是playersOrder中的第一个玩家
  const firstPlayerId = store.telephone.playersOrder?.[0]
  return firstPlayerId === store.userId
})
const readonlyCanvas = computed(() => {
  // 多链模式下，每个人都可以绘画自己分配到的链
  if (store.telephone.multiChain) {
    return store.telephone.phase !== 'drawing' || !store.telephone.myAssigneeChainId
  }
  
  // 单链模式：在绘画阶段且当前用户不是指派者时只读
  return store.telephone.phase === 'drawing' && (
    store.telephone.assigneeId !== store.userId && assigneeName.value !== store.username
  );
});
const canDescribe = computed(() => {
  if (store.telephone.phase !== 'describing') return false;
  
  // 多链模式下，每个人都可以描述自己分配到的链
  if (store.telephone.multiChain) {
    return !!store.telephone.myAssigneeChainId
  }
  
  // 单链模式：允许按指派ID或按用户名匹配
  return store.telephone.assigneeId === store.userId || assigneeName.value === store.username;
});
const canDraw = computed(() => {
  if (store.telephone.phase !== 'drawing') return false;
  
  // 多链模式下，每个人都可以绘画自己分配到的链
  if (store.telephone.multiChain) {
    return !!store.telephone.myAssigneeChainId
  }
  
  // 单链模式：允许按指派ID或按用户名匹配
  return store.telephone.assigneeId === store.userId || assigneeName.value === store.username;
});

// 检查当前用户是否已提交
const hasSubmitted = computed(() => {
  if (!store.telephone.multiChain) return false;
  const ls = store.telephone.lastSubmit
  if (!ls) return false
  
  // 兼容两种来源：
  // 1) 本地设置的 lastSubmit: { phase, stepIndex, ... }
  // 2) 服务器广播的 lastSubmit: { type, stepIndex, chainId, from, ... }
  const phase = store.telephone.phase
  const expectedType = phase === 'drawing' ? 'draw' : (phase === 'describing' ? 'desc' : '')
  const phaseMatch = ls.phase ? (ls.phase === phase) : (ls.type === expectedType)
  const indexMatch = ls.stepIndex === store.telephone.stepIndex
  const chainMatch = store.telephone.myAssigneeChainId ? (ls.chainId ? ls.chainId === store.telephone.myAssigneeChainId : true) : true
  const fromMatch = ls.from ? ls.from === store.userId : true
  
  return phaseMatch && indexMatch && chainMatch && fromMatch
});

// 倒计时（每秒刷新）
const nowTick = ref(Date.now())
const deadlineText = computed(() => {
  const dl = store.telephone.deadline
  if (!dl) return '—'
  try {
    const left = Math.max(0, new Date(dl).getTime() - nowTick.value)
    const s = Math.ceil(left / 1000)
    return s + 's'
  } catch (_) { return String(dl) }
})

// 超时自动提交：在截止时间到达时自动提交当前内容
const lastDeadlineKey = ref(null)
watch([nowTick, () => store.telephone.deadline, () => store.telephone.phase, () => store.telephone.stepIndex], async () => {
  const dl = store.telephone.deadline
  if (!dl) return
  let left
  try { left = new Date(dl).getTime() - nowTick.value } catch { return }
  const key = `${store.telephone.phase}:${store.telephone.stepIndex}:${store.telephone.multiChain ? (store.telephone.myAssigneeChainId || store.telephone.myChainId || '') : (store.telephone.chainId || '')}`
  if (left <= 0 && lastDeadlineKey.value !== key) {
    lastDeadlineKey.value = key
    // 仅在当前用户应当执行且尚未提交时自动提交
    if (!hasSubmitted.value) {
      try {
        if (store.telephone.phase === 'drawing' && canDraw.value && canvasComp.value) {
          await submitDrawing()
        } else if (store.telephone.phase === 'describing' && canDescribe.value) {
          await submitDesc()
        }
      } catch (e) {
        console.warn('自动提交失败:', e)
        // 如果失败，允许下一次tick再次尝试
        lastDeadlineKey.value = null
      }
    }
  }
})

// 房主：参与者顺序选择
const orderIds = ref([])
const availableMembers = computed(() => {
  const ids = new Set(orderIds.value)
  return store.members.filter(m => !ids.has(m.id))
})
function memberName(id) {
  const m = store.members.find(m => m.id === id)
  return m?.name || id
}
function syncOrderToStore() {
  // 仅保留在成员列表中的ID，不再限制人数
  orderIds.value = orderIds.value.filter(id => store.members.some(m => m.id === id))
  store.telephone.playersOrder = orderIds.value.slice()
}
function addMember(id) {
  if (orderIds.value.includes(id)) return
  orderIds.value.push(id)
  syncOrderToStore()
}
function removeMember(id) {
  orderIds.value = orderIds.value.filter(x => x !== id)
  syncOrderToStore()
}
function moveMember(index, delta) {
  const ni = index + delta
  if (ni < 0 || ni >= orderIds.value.length) return
  const arr = orderIds.value.slice()
  const [id] = arr.splice(index, 1)
  arr.splice(ni, 0, id)
  orderIds.value = arr
  syncOrderToStore()
}
watch(() => store.members, () => syncOrderToStore())
watch(() => store.telephone.playersOrder, (val) => { orderIds.value = Array.isArray(val) ? val.slice() : [] })

// 加载上一阶段数据：描述阶段展示上一张图；绘制阶段展示上一条描述
const prevStepImageUrl = ref('')
const currentPromptText = ref('')
async function loadPrevStep() {
  const isDescribing = store.telephone.phase === 'describing'
  let chainId
  if (store.telephone.multiChain) {
    chainId = store.telephone.myAssigneeChainId
  } else {
    chainId = store.telephone.chainId
  }
  const idx = Number(store.telephone.stepIndex) || 0
  const prevIndex = isDescribing ? idx : idx - 1
  prevStepImageUrl.value = ''
  currentPromptText.value = ''
  if (!chainId || prevIndex < 0) return
  try {
    const prev = await store.fetchTelephoneStep(store.currentRoom, chainId, prevIndex)
    if (isDescribing) {
      if (prev?.imageUrl) {
        const fullImageUrl = prev.imageUrl.startsWith('http') ? prev.imageUrl : `http://localhost:3001${prev.imageUrl}`
        prevStepImageUrl.value = fullImageUrl
      } else if (prev?.submit?.type === 'draw' && prev?.submit?.data?.imageUrl) {
        const submitImageUrl = prev.submit.data.imageUrl
        const fullImageUrl = submitImageUrl.startsWith('http') ? submitImageUrl : `http://localhost:3001${submitImageUrl}`
        prevStepImageUrl.value = fullImageUrl
      }
    } else {
      const text = prev?.desc?.data?.text || (prev?.submit?.type === 'desc' ? prev?.submit?.data?.text : '')
      if (text) {
        currentPromptText.value = text
        store.telephone.answer = text
        if (store.telephone.multiChain && chainId && store.telephone.chains[chainId]) {
          store.telephone.chains[chainId].answer = text
        }
      }
    }
  } catch (e) {
    console.warn('[TEL][Room] loadPrevStep failed:', e)
  }
}
watch([() => store.telephone.phase, () => store.telephone.stepIndex, () => store.telephone.chainId], () => { loadPrevStep() })

function measureCanvas() {
  const el = gameAreaRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  canvasW.value = Math.max(0, Math.floor(rect.width))
  canvasH.value = Math.max(0, Math.floor(rect.height))
}

let ro = null
let tickHandle = null
onMounted(() => {
  if (!store.isReady) {
    router.push('/')
    return
  }
  if (store.currentRoom !== roomId.value) {
    store.joinRoom(roomId.value).catch(() => { router.push('/') })
  }
  store.clearError()
  measureCanvas()
  ro = new ResizeObserver(() => measureCanvas())
  if (gameAreaRef.value) ro.observe(gameAreaRef.value)
  window.addEventListener('resize', measureCanvas)
  tickHandle = setInterval(() => { nowTick.value = Date.now() }, 1000)
  orderIds.value = Array.isArray(store.telephone.playersOrder) ? store.telephone.playersOrder.slice() : []
})

onUnmounted(() => {
  store.clearError()
  if (ro && gameAreaRef.value) ro.unobserve(gameAreaRef.value)
  window.removeEventListener('resize', measureCanvas)
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null }
})

// 派生：房主昵称（由ID映射）
const ownerName = computed(() => {
  const id = store.roomOwner
  const m = store.members.find(m => m.id === id)
  return m?.name || ''
})

// 过滤：仅显示未被静音的聊天消息；系统消息始终显示
const visibleMessages = computed(() => {
  return store.messages.filter(m => m.type !== 'chat' || !store.mutedIds.includes(m.fromId))
})

// 控制：游戏开始与推进（房主）
const startGame = async () => {
  if (!store.isOwner) return
  const config = store.roomConfig
  if (config.wordLibraryType === 'system' && (!config.selectedLibraries || config.selectedLibraries.length === 0)) {
    store.setError('请先在房间设置中选择词库')
    return
  }
  store.telephoneStartGame()
}
const nextStage = async () => {
  if (!store.isOwner) return
  try {
    if (store.telephone.phase === 'drawing' && canvasComp.value && canvasComp.value.exportBlob) {
      const blob = await canvasComp.value.exportBlob()
      if (blob) { await store.telephoneUploadImage(blob) }
    }
    store.telephoneNextStage()
  } catch (e) { console.warn('推进阶段失败:', e) }
}

const submitDesc = async () => {
  if (!store.telephone.multiChain && !canDescribe.value) return
  try {
    await store.telephoneSubmitDesc(store.telephone.descDraft)
    store.telephone.descDraft = ''
    if (store.telephone.multiChain) {
      store.telephone.lastSubmit = {
        phase: store.telephone.phase,
        type: 'desc',
        stepIndex: store.telephone.stepIndex,
        chainId: store.telephone.myAssigneeChainId || store.telephone.chainId,
        from: store.userId,
        at: Date.now()
      }
    }
    if (!store.telephone.multiChain) { store.telephoneNextStage() }
  } catch (e) { console.warn('[TEL][Room] submitDesc failed:', e) }
}

const submitDrawing = async () => {
  if (!canDraw.value) return
  try {
    const blob = await canvasComp.value.exportBlob()
    if (blob) {
      await store.telephoneUploadImage(blob)
      store.telephone.lastSubmit = {
        phase: store.telephone.phase,
        type: 'draw',
        stepIndex: store.telephone.stepIndex,
        chainId: store.telephone.myAssigneeChainId || store.telephone.chainId,
        from: store.userId,
        at: Date.now()
      }
      if (!store.telephone.multiChain) { store.telephoneNextStage() }
    }
  } catch (e) { console.warn('[TEL][Room] submitDrawing failed:', e) }
}

// 折叠切换
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
  requestAnimationFrame(measureCanvas)
}

// ChatPanel 发送事件
const handleChatSend = async (text) => {
  const payload = String(text || '').trim()
  if (!payload || !store.socketConnected) return
  try { await store.sendMessage(payload) } catch (error) { console.error('发送消息失败:', error); store.setError('发送消息失败，请重试') }
}

// 离开房间
const leaveRoom = async () => {
  try { await store.leaveRoom(roomId.value); router.push('/') } catch (error) { console.error('离开房间失败:', error); router.push('/') }
}

// 监听路由参数变化
watch(() => route.params.id, (newRoomId) => {
  if (newRoomId) { roomId.value = newRoomId; requestAnimationFrame(measureCanvas) }
})

// 监听被踢事件并返回大厅
watch(() => store.kickedInfo, (info) => { if (info) { router.push('/') } })

// 监听键盘事件
const handleKeydown = (event) => { if (event.key === 'Escape' && showMobileSidebar.value) { showMobileSidebar.value = false } }

onMounted(() => { document.addEventListener('keydown', handleKeydown) })
onUnmounted(() => { document.removeEventListener('keydown', handleKeydown) })

// 房间配置处理函数
const handleConfigSave = async (config) => { try { await store.saveRoomConfig(config); showConfigDialog.value = false } catch (error) { console.error('保存配置失败:', error) } }

// 结果播放状态
const resultChains = ref([])
const resultChainIndex = ref(0)
const currentResultChainId = computed(() => resultChains.value[resultChainIndex.value] || null)
const resultSteps = ref([])
const resultStepDisplayIndex = ref(0)
const resultCaptionLabel = ref('题目')
const resultCaptionText = ref('')
const resultDescText = ref('')
const resultDescAuthorName = ref('')
const resultImageUrl = ref('')
const showVotePanel = ref(false)
const playIntervalMs = 2000
let resultPlayAbort = { value: false }
// 新增：结果阶段画布回放
const resultUseCanvas = ref(false)
const resultCanvasRef = ref(null)
let resultCtx = null
const resultInitAnswer = ref('')
const resultFinalDesc = ref('')

async function setupResultCanvas() {
  await nextTick()
  const canvas = resultCanvasRef.value
  if (!canvas) return
  resultCtx = canvas.getContext('2d')
  resultCtx.clearRect(0, 0, canvas.width, canvas.height)
  resultCtx.save()
  resultCtx.fillStyle = '#fffaf0'
  resultCtx.fillRect(0, 0, canvas.width, canvas.height)
  resultCtx.restore()
}

function clearResultCanvas() {
  const canvas = resultCanvasRef.value
  if (!canvas || !resultCtx) return
  resultCtx.clearRect(0, 0, canvas.width, canvas.height)
  resultCtx.save()
  resultCtx.fillStyle = '#fffaf0'
  resultCtx.fillRect(0, 0, canvas.width, canvas.height)
  resultCtx.restore()
}

async function playDrawEvents(chainId, stepIndex) {
  resultUseCanvas.value = true
  resultImageUrl.value = ''
  await setupResultCanvas()
  clearResultCanvas()
  try {
    const ev = await store.fetchTelephoneEvents(store.currentRoom, chainId, stepIndex)
    const events = ev?.events || []
    let lastP = null
    for (const e of events) {
      if (resultPlayAbort.value) return
      if (!resultCtx) break
      if (e.type === 'clear') {
        clearResultCanvas()
      } else if (e.type === 'begin') {
        lastP = { x: e.x, y: e.y }
      } else if (e.type === 'move') {
        const from = lastP || { x: e.x, y: e.y }
        resultCtx.save()
        const strokeColor = e.tool === 'eraser' ? '#fffaf0' : (e.color || '#000')
        resultCtx.strokeStyle = strokeColor
        resultCtx.lineWidth = e.size || 6
        resultCtx.lineCap = 'round'
        resultCtx.lineJoin = 'round'
        resultCtx.globalCompositeOperation = 'source-over'
        resultCtx.beginPath()
        resultCtx.moveTo(from.x, from.y)
        resultCtx.lineTo(e.x, e.y)
        resultCtx.stroke()
        resultCtx.restore()
        lastP = { x: e.x, y: e.y }
      } else if (e.type === 'end') {
        lastP = null
      }
      await delay(10)
    }
  } catch (err) {
    console.warn('回放事件失败:', err)
  }
}

// 结果阶段初始化
async function initResultPlayback() {
  resultPlayAbort.value = false
  showVotePanel.value = false
  
  if (store.telephone.multiChain) {
    // 多链模式：优先使用本地chains，为空时拉取
    if (store.telephone.chains && Object.keys(store.telephone.chains).length > 0) {
      resultChains.value = Object.keys(store.telephone.chains)
    } else {
      try {
        const data = await store.fetchTelephoneChains(store.currentRoom)
        resultChains.value = data?.chains?.map(c => c.chainId) || []
      } catch (e) {
        console.warn('获取链列表失败:', e)
        resultChains.value = []
      }
    }
  } else {
    // 单链模式：使用当前chainId
    resultChains.value = store.telephone.chainId ? [store.telephone.chainId] : []
  }
  
  resultChainIndex.value = 0
  if (resultChains.value.length > 0) {
    await loadAndPlayCurrentChain()
  }
}

async function loadAndPlayCurrentChain() {
  const chainId = currentResultChainId.value
  if (!chainId) return
  // fetch chain info
  const data = await store.fetchTelephoneChain(store.currentRoom, chainId)
  console.log('[前端] 加载链数据:', chainId, data)
  resultSteps.value = data?.steps || []
  const initAnswer = data?.answer || ''
  resultCaptionLabel.value = '题目'
  resultCaptionText.value = initAnswer
  resultInitAnswer.value = initAnswer // 设置原始题目用于投票面板
  console.log('[前端] 设置原始题目:', initAnswer)
  // 计算最后描述文本
  try {
    // 优先寻找描述类型的步骤
    let lastDescStep = [...resultSteps.value].reverse().find(s => s.type === 'desc')
    
    // 如果没有描述步骤，尝试从最后一个绘画步骤获取描述
    if (!lastDescStep) {
      const lastDrawStep = [...resultSteps.value].reverse().find(s => s.type === 'draw')
      if (lastDrawStep) {
        lastDescStep = lastDrawStep
      }
    }
    
    if (lastDescStep) {
      const detail = await store.fetchTelephoneStep(store.currentRoom, chainId, lastDescStep.stepIndex)
      console.log('[前端] 最后描述步骤详情:', detail)
      const text = detail?.desc?.data?.text || detail?.submit?.data?.text || ''
      resultFinalDesc.value = text
      console.log('[前端] 设置最后描述:', text)
    } else {
      resultFinalDesc.value = ''
    }
  } catch (e) { console.warn('获取最后描述失败:', e) }
  resultStepDisplayIndex.value = 0
  resultImageUrl.value = ''
  resultDescText.value = ''
  resultDescAuthorName.value = ''
  resultUseCanvas.value = false
  await playChainSequence(chainId)
}

async function playChainSequence(chainId) {
  console.log('[前端] 开始播放链序列:', chainId, '步骤数:', resultSteps.value.length)
  for (let i = 0; i < resultSteps.value.length; i++) {
    if (resultPlayAbort.value) return
    const step = resultSteps.value[i]
    console.log('[前端] 播放步骤:', i, step)
    resultStepDisplayIndex.value = step.stepIndex
    if (step.type === 'draw') {
      if (step.hasEvents) {
        console.log('[前端] 播放绘画事件:', step.stepIndex)
        await playDrawEvents(chainId, step.stepIndex)
      } else {
        console.log('[前端] 显示静态图片:', step.imageUrl)
        resultUseCanvas.value = false
        resultImageUrl.value = normalizeImageUrl(step.imageUrl)
      }
      const next = resultSteps.value[i + 1]
      if (next && next.type === 'desc') {
        try {
          const detail = await store.fetchTelephoneStep(store.currentRoom, chainId, next.stepIndex)
          console.log('[前端] 加载描述步骤详情:', detail)
          const text = detail?.desc?.data?.text || detail?.submit?.data?.text || ''
          const authorId = detail?.desc?.userId || detail?.submit?.from || detail?.meta?.assigneeId
          resultDescText.value = text
          resultDescAuthorName.value = memberName(authorId)
          resultCaptionLabel.value = '当前描述'
          resultCaptionText.value = text
          console.log('[前端] 设置描述:', text, '作者:', authorId)
        } catch (e) { console.warn('加载描述失败:', e) }
      } else {
        // 如果没有下一个描述步骤，尝试从当前绘画步骤获取描述
        try {
          const detail = await store.fetchTelephoneStep(store.currentRoom, chainId, step.stepIndex)
          console.log('[前端] 加载当前步骤描述详情:', detail)
          const text = detail?.desc?.data?.text || detail?.submit?.data?.text || ''
          const authorId = detail?.desc?.userId || detail?.submit?.from || detail?.meta?.assigneeId
          if (text) {
            resultDescText.value = text
            resultDescAuthorName.value = memberName(authorId)
            resultCaptionLabel.value = '当前描述'
            resultCaptionText.value = text
            console.log('[前端] 从绘画步骤设置描述:', text, '作者:', authorId)
          } else {
            resultDescText.value = ''
            resultDescAuthorName.value = ''
          }
        } catch (e) { 
          console.warn('加载当前步骤描述失败:', e)
          resultDescText.value = ''
          resultDescAuthorName.value = ''
        }
      }
      await delay(playIntervalMs)
    } else {
      await delay(600)
    }
  }
  console.log('[前端] 播放完成，显示投票面板')
  showVotePanel.value = true
}

// 辅助函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeImageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const baseUrl = socketManager.getServerUrl?.() || 'http://localhost:3001'
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

const votesForCurrent = computed(() => {
  const chainId = currentResultChainId.value
  const votes = store.telephone.votes?.[chainId] || {}
  const res = {}
  for (const m of store.members) { res[m.id] = votes[m.id] }
  return res
})

// 切换链时重新播放
watch(resultChainIndex, async () => {
  resultPlayAbort.value = true
  await nextTick()
  resultPlayAbort.value = false
  showVotePanel.value = false
  await loadAndPlayCurrentChain()
})

// 自动进入下一链：当所有成员已对当前链投票
const allVoted = computed(() => {
  const chainId = currentResultChainId.value
  if (!chainId) return false
  const votes = store.telephone.votes?.[chainId] || {}
  const ids = store.members.map(m => m.id)
  return ids.length > 0 && ids.every(id => typeof votes[id] !== 'undefined')
})

watch(allVoted, (done) => {
  if (!done) return
  if (resultChainIndex.value < resultChains.value.length - 1) {
    resultChainIndex.value += 1
  }
})

// 投票操作
async function vote(pass) {
  const chainId = currentResultChainId.value
  if (!chainId) return
  try {
    await store.telephoneVote(chainId, pass)
  } catch (e) {
    console.warn('投票失败:', e)
  }
}
</script>

<style scoped>
.loading-spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>