<template>
  <div class="members-list relative" @click="hideMenu">
    <div class="members-header">
      <h3 class="members-title">
        在线成员 ({{ members.length }})
      </h3>
      <button 
        v-if="showToggle"
        @click="toggleCollapsed"
        class="toggle-button"
        :class="{ 'collapsed': isCollapsed }"
      >
        {{ isCollapsed ? '展开' : '收起' }}
      </button>
    </div>
    
    <Transition name="slide">
      <div v-if="!isCollapsed" class="members-content">
        <div v-if="members.length === 0" class="empty-members">
          <div class="empty-icon">👥</div>
          <p class="empty-text">暂无成员</p>
        </div>
        
        <div v-else class="members-grid">
          <div 
            v-for="member in members" 
            :key="member.id"
            class="member-item"
            :class="{ 'current-user': member.id === currentUserId, 'speaking': isSpeaking(member.id) }"
            @contextmenu.prevent="onMemberContextMenu($event, member)"
          >
            <div class="member-avatar" :style="{ backgroundColor: getAvatarColor(member) }">
              {{ getAvatarText(member) }}
            </div>
            <div class="member-info">
              <span class="voice-indicator" v-if="isVoiceMember(member.id)" title="语音中"></span>
              <span class="member-name" :class="{ 'speaking': isSpeaking(member.id) }">
                {{ member.name }}
              </span>
              <span v-if="member.id === currentUserId" class="member-badge">
                (你)
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 右键菜单 使用 Teleport 到 body，固定到视口 -->
    <teleport to="body">
      <div 
        v-if="contextMenu.visible && ((isOwner && contextMenu.member?.id !== roomOwner) || (contextMenu.member?.id !== currentUserId))" 
        class="context-menu"
        ref="menuRef"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      >
        <button 
          v-if="isOwner && contextMenu.member?.id !== roomOwner"
          class="menu-item text-red-600"
          @click="kick(contextMenu.member.id)"
        >踢出房间</button>
        <button v-if="contextMenu.member?.id !== currentUserId" class="menu-item" @click="toggleMute(contextMenu.member.id)">
          {{ isMuted(contextMenu.member) ? '取消静音' : '静音' }}
        </button>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useStore } from '@/store'

// Props
const props = defineProps({
  members: {
    type: Array,
    default: () => []
  },
  collapsible: {
    type: Boolean,
    default: false
  },
  defaultCollapsed: {
    type: Boolean,
    default: false
  }
})

// Store
const store = useStore()

// Refs
const isCollapsed = ref(props.defaultCollapsed)
const contextMenu = ref({ visible: false, x: 0, y: 0, member: null })
const menuRef = ref(null)

// Computed
const currentUsername = computed(() => store.username)
const currentUserId = computed(() => store.userId)
const showToggle = computed(() => props.collapsible)
const roomOwner = computed(() => store.roomOwner)
const isOwner = computed(() => store.isOwner)

// 语音状态
const voiceMembers = computed(() => store.voiceMembers)
const speakingIds = computed(() => store.speakingIds)
const isVoiceMember = (id) => voiceMembers.value.includes(id)
const isSpeaking = (id) => speakingIds.value.includes(id)

// Methods
const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value
}

const clampWithinViewport = () => {
  const el = menuRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const padding = 8
  const maxLeft = window.innerWidth - rect.width - padding
  const maxTop = window.innerHeight - rect.height - padding
  if (contextMenu.value.x > maxLeft) contextMenu.value.x = Math.max(padding, maxLeft)
  if (contextMenu.value.y > maxTop) contextMenu.value.y = Math.max(padding, maxTop)
}

const onMemberContextMenu = async (evt, member) => {
  if (!member) return
  // 如果无可用操作则不展示菜单
  const canKick = isOwner.value && member.id !== roomOwner.value
  const canMute = member.id !== currentUserId.value
  if (!canKick && !canMute) return

  contextMenu.value.visible = true
  // 使用视口坐标，固定到窗口
  contextMenu.value.x = evt.clientX + 8
  contextMenu.value.y = evt.clientY
  contextMenu.value.member = member
  await nextTick()
  clampWithinViewport()
}

const hideMenu = () => {
  contextMenu.value.visible = false
}

const kick = async (memberId) => {
  try {
    await store.kickMember(memberId)
  } catch (e) {
    // 错误已由store处理
  } finally {
    hideMenu()
  }
}

const toggleMute = (memberId) => {
  if (memberId === currentUserId.value) return
  store.toggleMute(memberId)
  hideMenu()
}

const isMuted = (member) => {
  return store.mutedIds.includes(member.id)
}

const getAvatarText = (member) => {
  const username = member?.name || ''
  if (!username) return '?'
  const firstChar = username.charAt(0).toUpperCase()
  if (/[\u4e00-\u9fa5]/.test(firstChar)) return firstChar
  if (/[A-Z]/.test(firstChar)) return firstChar
  return '?'
}

const getAvatarColor = (member) => {
  const basis = member?.name || member?.id || ''
  if (!basis) return '#6b7280'
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ]
  let hash = 0
  for (let i = 0; i < basis.length; i++) {
    hash = basis.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// 点击外部关闭菜单（简单实现）
const onGlobalClick = (e) => {
  const el = menuRef.value
  if (!el) return
  if (!el.contains(e.target)) hideMenu()
}

onMounted(() => {
  document.addEventListener('click', onGlobalClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onGlobalClick)
})
</script>

<style scoped>
.members-list {
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.members-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.toggle-button {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.toggle-button:hover {
  background-color: #e5e7eb;
  color: #374151;
}

.members-content {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
}

/* 自定义滚动条 */
.members-content::-webkit-scrollbar {
  width: 4px;
}

.members-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.members-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

/* 空状态 */
.empty-members {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

/* 成员网格 */
.members-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.member-item:hover {
  background-color: #f3f4f6;
}

.member-item.current-user {
  background-color: #dbeafe;
}

.member-item.current-user:hover {
  background-color: #bfdbfe;
}

/* 头像 */
.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

/* 成员信息 */
.member-info {
  text-align: center;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  display: block;
}

.member-badge {
  font-size: 12px;
  color: #6b7280;
  font-weight: normal;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 1000;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: block;
  background: #f9fafb;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: #eef2ff;
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 300px;
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .members-list {
    margin-bottom: 16px;
  }
  
  .members-content {
    max-height: 200px;
  }
  
  .member-avatar {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }
  
  .member-name {
    font-size: 13px;
  }
  
  .members-grid {
    gap: 6px;
  }
  
  .member-item {
    padding: 6px;
  }
}

/* 紧凑模式 */
@media (max-width: 640px) {
  .members-header {
    padding: 10px 12px;
  }
  
  .members-content {
    padding: 8px;
  }
  
  .members-title {
    font-size: 13px;
  }
  
  .toggle-button {
    font-size: 11px;
    padding: 3px 6px;
  }
}
.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
}
.member-item.speaking {
  background-color: rgba(14, 165, 233, 0.08);
}
.member-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.voice-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}
.member-name.speaking {
  color: #0ea5e9;
  font-weight: 600;
}
</style>