<template>
  <div class="p-4">
    <h1 class="text-xl font-bold mb-3">传话模式</h1>

    <div v-if="!store.inRoom" class="p-3 bg-yellow-100 border border-yellow-300 rounded space-y-3">
      <p class="font-medium">尚未加入房间，可直接在此加入或返回大厅。</p>
      <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <label class="flex-1">
          <span class="block text-sm text-gray-700">房间ID</span>
          <input v-model="roomIdInput" class="w-full p-2 border rounded" placeholder="例如：room-123" />
        </label>
        <label class="flex-1">
          <span class="block text-sm text-gray-700">用户名</span>
          <input v-model="usernameInput" class="w-full p-2 border rounded" placeholder="你的名字" />
        </label>
        <button class="px-3 py-2 bg-blue-600 text-white rounded" @click="quickJoin">直接加入</button>
      </div>
      <div class="text-sm text-gray-600">也可携带参数访问：<code>/telephone?roomId=房间ID&username=你的名字</code> 将自动尝试加入。</div>
      <router-link to="/" class="inline-block px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">返回大厅</router-link>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 space-y-3">
        <div class="flex items-center gap-4 p-3 bg-gray-50 border rounded">
          <div>房间：<span class="font-mono">{{ store.currentRoom }}</span></div>
          <div>链：<span class="font-mono">{{ store.telephone.chainId || '未初始化' }}</span></div>
          <div>步：<span class="font-mono">{{ store.telephone.stepIndex }}</span></div>
          <div>阶段：<span class="font-mono">{{ store.telephone.phase }}</span></div>
          <div v-if="store.telephone.deadline">截止：<span class="font-mono">{{ deadlineText }}</span></div>
          <div class="ml-auto flex items-center gap-2">
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="initChain">初始化链</button>
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="toDrawing">切到绘制</button>
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="toDesc">切到描述</button>
          </div>
        </div>

        <div v-if="store.telephone.phase === 'drawing'" class="space-y-3">
          <TelephoneCanvas ref="canvasComp" :width="canvasW" :height="canvasH" />
          <div class="flex items-center gap-3">
            <button class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded" @click="submitImage">提交画作</button>
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="clearCanvas">清空画布</button>
          </div>
        </div>

        <div v-else-if="store.telephone.phase === 'describing'" class="space-y-3">
          <textarea v-model="desc" rows="6" class="w-full p-2 border rounded" placeholder="请输入对上一幅画的描述..." />
          <div class="flex items-center gap-3">
            <button class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded" @click="submitDesc">提交描述</button>
          </div>
        </div>

        <div v-else class="p-3 border rounded text-gray-500">阶段空闲，等待开始或切换阶段。</div>
      </div>

      <div class="space-y-3">
        <div class="p-3 border rounded bg-gray-50">
          <h2 class="font-semibold mb-2">最近提交</h2>
          <div v-if="store.telephone.lastSubmit" class="text-sm">
            <div>链：{{ store.telephone.lastSubmit.chainId }}</div>
            <div>步：{{ store.telephone.lastSubmit.stepIndex }}</div>
            <div>类型：{{ store.telephone.lastSubmit.type }}</div>
            <div>来自：{{ store.telephone.lastSubmit.from }}</div>
            <div>时间：{{ new Date(store.telephone.lastSubmit.at).toLocaleString() }}</div>
          </div>
          <div v-else class="text-gray-500">暂无</div>
        </div>

        <div class="p-3 border rounded bg-gray-50">
          <h2 class="font-semibold mb-2">操作</h2>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="prevStep">前一步</button>
            <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="nextStep">下一步</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '@/store/index.js'
import TelephoneCanvas from '@/components/TelephoneCanvas.vue'

const route = useRoute()
const store = useStore()
const canvasComp = ref(null)
const canvasW = 900
const canvasH = 550

const desc = ref('')

// 未加入房间时的快速加入输入
const roomIdInput = ref(String(route.query.roomId || ''))
const usernameInput = ref(String(route.query.username || (localStorage.getItem('username') || '')))

async function quickJoin() {
  const roomId = roomIdInput.value.trim()
  const username = usernameInput.value.trim()
  if (!roomId) return
  if (!store.socketConnected) {
    await store.connect(username || store.username || '玩家')
  }
  await store.joinRoom(roomId)
}

onMounted(async () => {
  if (!store.inRoom) {
    const roomId = String(route.query.roomId || '').trim()
    const username = String(route.query.username || (localStorage.getItem('username') || '')).trim()
    if (roomId) {
      if (!store.socketConnected) {
        await store.connect(username || store.username || '玩家')
      }
      await store.joinRoom(roomId)
    }
  }
})

const deadlineText = computed(() => {
  const dl = store.telephone.deadline
  if (!dl) return '—'
  try {
    const left = Math.max(0, new Date(dl).getTime() - Date.now())
    const s = Math.ceil(left / 1000)
    return s + 's'
  } catch (_) { return String(dl) }
})

function initChain() {
  store.telephoneInitChain()
}
function toDrawing() {
  store.telephoneEmitPhase('drawing')
}
function toDesc() {
  store.telephoneEmitPhase('describing')
}

async function submitImage() {
  try {
    const blob = await canvasComp.value.exportBlob()
    await store.telephoneUploadImage(blob)
  } catch (e) {
    console.error(e)
  }
}
function clearCanvas() { canvasComp.value.clearCanvas() }

async function submitDesc() {
  try {
    const text = desc.value.trim()
    if (!text) return
    await store.telephoneSubmitDesc(text)
    desc.value = ''
  } catch (e) { console.error(e) }
}

function prevStep() {
  const i = (store.telephone.stepIndex || 0) - 1
  store.telephoneSetStep(Math.max(0, i))
}
function nextStep() {
  const i = (store.telephone.stepIndex || 0) + 1
  store.telephoneSetStep(i)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center gap-3">
      <div>
        <span class="text-sm text-gray-600">阶段：</span>
        <span class="font-medium">{{ store.telephone.phase }}</span>
      </div>
      <button class="px-3 py-1 bg-blue-500 text-white rounded" @click="switchToDescribe">切换到描述阶段</button>
    </div>

    <div v-if="store.telephone.phase === 'drawing'" class="border border-dashed border-gray-400 rounded h-[60vh]">
      <div ref="containerRef" class="relative w-full h-full">
        <TelephoneCanvas :width="canvasW" :height="canvasH" :controlsInside="true" />
      </div>
    </div>

    <div v-else-if="store.telephone.phase === 'describing'" class="p-4">
      <textarea v-model="store.telephone.descDraft" class="w-full h-40 border rounded p-2" placeholder="请输入你的描述..." />
      <div class="mt-3 flex gap-3">
        <button class="px-3 py-1 bg-green-500 text-white rounded" @click="submitDesc">提交描述</button>
        <button class="px-3 py-1 bg-gray-200 rounded" @click="store.telephone.descDraft = ''">清空</button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button class="px-3 py-1 bg-gray-200 rounded" @click="prevStep">上一步</button>
      <button class="px-3 py-1 bg-gray-200 rounded" @click="nextStep">下一步</button>
      <span class="text-sm text-gray-600">当前步：{{ store.telephone.stepIndex }}</span>
    </div>
  </div>
</template>