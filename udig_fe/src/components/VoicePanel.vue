<template>
  <div class="voice-panel">
    <div class="voice-controls">
      <button class="btn" @click="onJoinLeave">
        {{ store.inVoice ? '退出语音' : '加入语音' }}
      </button>
      <button class="btn" :disabled="!store.inVoice" @click="store.toggleMic()">
        {{ store.isMicMuted ? '开启麦克风' : '关闭麦克风' }}
      </button>
      <button class="btn" :disabled="!store.inVoice" @click="store.toggleDeaf()">
        {{ store.isDeaf ? '取消禁听' : '禁听(Deaf)' }}
      </button>
      <div class="volume">
        <label>音量</label>
        <input type="range" min="0" max="1" step="0.01" :value="store.playVolume" @input="onVolume" />
      </div>
      <span class="status" v-if="store.inVoice">
        本地状态：<strong :class="{ speaking: isLocalSpeaking }">{{ isLocalSpeaking ? '正在说话' : '静音/未说话' }}</strong>
      </span>
    </div>

    <div v-if="store.inVoice" class="voice-streams">
      <div v-for="(stream, peerId) in store.voiceRemoteStreams" :key="peerId" class="voice-stream-item">
        <div class="peer-info">
          <span class="dot" :class="{ active: speakingIds.includes(peerId) }"></span>
          <span class="peer-id">{{ displayMemberName(peerId) }}</span>
        </div>
        <audio :ref="el => setAudioRef(peerId, el)" autoplay playsinline></audio>
      </div>
      <div v-if="Object.keys(store.voiceRemoteStreams).length === 0" class="empty">
        暂无远端语音流
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, reactive } from 'vue'
import { useStore } from '@/store'

const store = useStore()

const speakingIds = computed(() => store.speakingIds)
const isLocalSpeaking = computed(() => speakingIds.value.includes(store.userId) && !store.isMicMuted)

// 维护每个远端 audio 引用
const audioRefs = reactive({})

const setAudioRef = (peerId, el) => {
  if (!el) return
  audioRefs[peerId] = el
  applyStreamAndVolume(peerId)
}

const applyStreamAndVolume = (peerId) => {
  const el = audioRefs[peerId]
  if (!el) return
  const stream = store.voiceRemoteStreams[peerId]
  if (stream) {
    try { el.srcObject = stream } catch (_) {}
  }
  el.muted = !!store.isDeaf
  el.volume = Number(store.playVolume) || 0
}

watch(() => store.voiceRemoteStreams, (val) => {
  // 远端流更新时同步到 audio
  Object.keys(val || {}).forEach(pid => applyStreamAndVolume(pid))
}, { deep: true })

watch(() => store.playVolume, () => {
  Object.keys(audioRefs).forEach(pid => applyStreamAndVolume(pid))
})

watch(() => store.isDeaf, () => {
  Object.keys(audioRefs).forEach(pid => applyStreamAndVolume(pid))
})

const onJoinLeave = async () => {
  if (!store.inVoice) {
    await store.joinVoice()
  } else {
    await store.leaveVoice()
  }
}

const onVolume = (e) => {
  store.setPlayVolume(e.target.value)
}

const displayMemberName = (id) => {
  const m = store.members.find(x => x.id === id)
  return m?.name || id || '未知用户'
}
</script>

<style scoped>
.voice-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
}
.voice-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.btn {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.volume { display: flex; align-items: center; gap: 8px; }
.status { font-size: 12px; color: #6b7280; }
.status .speaking { color: #0ea5e9; font-weight: 600; }
.voice-streams { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.voice-stream-item { border: 1px solid #f3f4f6; border-radius: 8px; padding: 8px; background: #fafafa; }
.peer-info { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.peer-id { font-size: 13px; color: #374151; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
.dot.active { background: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,0.25); }
.empty { font-size: 12px; color: #6b7280; }
</style>