<template>
  <div class="flex flex-col gap-2">
    <!-- 顶部工具条（默认外置） -->
    <div v-if="!controlsInside" class="flex items-center gap-3">
      <label class="flex items-center gap-2">
        <span>颜色</span>
        <input type="color" v-model="color" />
      </label>
      <label class="flex items-center gap-2">
        <span>粗细</span>
        <input type="range" min="1" max="20" v-model.number="size" />
        <span>{{ size }}</span>
      </label>
      <button class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded" @click="clearCanvas">清空画布</button>
      <button class="px-3 py-1 rounded" :class="isEraser ? 'bg-orange-300 hover:bg-orange-400' : 'bg-gray-200 hover:bg-gray-300'" @click="isEraser = !isEraser">{{ isEraser ? '橡皮擦: 开' : '橡皮擦: 关' }}</button>
    </div>

    <!-- 画布容器：相对定位，支持内嵌控件 -->
    <div class="relative inline-block w-full h-full">
      <!-- 内嵌工具条（覆盖在画布边界内；透明悬浮） -->
      <div v-if="controlsInside" class="absolute inset-x-2 top-2 flex items-center gap-3 px-2 py-1 rounded pointer-events-auto">
        <label class="flex items-center gap-2">
          <span class="text-xs text-gray-700">颜色</span>
          <input type="color" v-model="color" />
        </label>
        <label class="flex items-center gap-2">
          <span class="text-xs text-gray-700">粗细</span>
          <input type="range" min="1" max="20" v-model.number="size" />
          <span class="text-xs">{{ size }}</span>
        </label>
        <button class="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs" @click="clearCanvas">清空</button>
        <button class="px-2 py-1 rounded text-xs" :class="isEraser ? 'bg-orange-300 hover:bg-orange-400' : 'bg-gray-200 hover:bg-gray-300'" @click="isEraser = !isEraser">{{ isEraser ? '橡皮' : '画笔' }}</button>
      </div>

      <!-- 指针圆形与画布 -->
      <div v-show="cursorVisible" :style="cursorStyle" class="pointer-circle"></div>
      <canvas
        ref="canvasRef"
        :width="width"
        :height="height"
        :style="{ backgroundColor: bgColor, width: '100%', height: '100%' }"
        class="border border-gray-300 rounded shadow"
        @pointerenter="onPointerEnter"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerLeave"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend.prevent="onTouchEnd"
        @touchcancel.prevent="onTouchEnd"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useStore } from '@/store/index.js'

const props = defineProps({
  width: { type: Number, default: 900 },
  height: { type: Number, default: 550 },
  controlsInside: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})

const store = useStore()
const canvasRef = ref(null)
const ctx = ref(null)

const bgColor = '#fffaf0' // 象牙白，类纸色
const color = ref('#000000')
const size = ref(6)
const isEraser = ref(false)

const drawing = ref(false)
const lastPoint = ref(null)
const eventQueue = ref([])
let flushTimer = null

const cursorVisible = ref(false)
const cursorStyle = ref({})

function pushEvent(evt) {
  if (props.readonly) return
  eventQueue.value.push({
    ...evt,
    t: Date.now(),
    color: isEraser.value ? bgColor : color.value,
    size: size.value,
    tool: isEraser.value ? 'eraser' : 'pen',
  })
}

function flushEvents() {
  if (props.readonly) { eventQueue.value.length = 0; return }
  if (!eventQueue.value.length) return
  const batch = eventQueue.value.splice(0, eventQueue.value.length)
  try {
    store.telephoneSendDrawEvents(batch)
  } catch (e) {
    console.warn('发送绘画事件失败:', e)
  }
}

function fillBackground() {
  if (!ctx.value) return
  ctx.value.save()
  ctx.value.globalCompositeOperation = 'source-over'
  ctx.value.fillStyle = bgColor
  ctx.value.fillRect(0, 0, props.width, props.height)
  ctx.value.restore()
}

function clearCanvas() {
  if (props.readonly) return
  if (!ctx.value) return
  ctx.value.clearRect(0, 0, props.width, props.height)
  fillBackground()
  pushEvent({ type: 'clear' })
  flushEvents()
}

function drawLine(from, to) {
  if (!ctx.value) return
  ctx.value.save()
  ctx.value.strokeStyle = isEraser.value ? bgColor : color.value
  ctx.value.lineWidth = size.value
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.globalCompositeOperation = 'source-over'
  ctx.value.beginPath()
  ctx.value.moveTo(from.x, from.y)
  ctx.value.lineTo(to.x, to.y)
  ctx.value.stroke()
  ctx.value.restore()
}

function getCanvasMetrics() {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const style = getComputedStyle(canvas)
  const bl = parseFloat(style.borderLeftWidth) || 0
  const bt = parseFloat(style.borderTopWidth) || 0
  const br = parseFloat(style.borderRightWidth) || 0
  const bb = parseFloat(style.borderBottomWidth) || 0
  const contentW = rect.width - bl - br
  const contentH = rect.height - bt - bb
  const scaleX = canvas.width / (contentW || 1)
  const scaleY = canvas.height / (contentH || 1)
  return { rect, bl, bt, scaleX, scaleY }
}

// 计算指针在画布内容坐标中的位置（考虑CSS缩放与边框）
function getCanvasPoint(e) {
  const { rect, bl, bt, scaleX, scaleY } = getCanvasMetrics()
  const x = (e.clientX - rect.left - bl) * scaleX
  const y = (e.clientY - rect.top - bt) * scaleY
  return { x, y, scaleX, scaleY, rect }
}

function updateCursor(e) {
  const { rect, bl, bt, scaleX, scaleY } = getCanvasMetrics()
  const left = e.clientX - rect.left - bl
  const top = e.clientY - rect.top - bt
  // 使用平均缩放确保圆形形状，同时接近实际画笔尺寸
  const avgScale = (scaleX + scaleY) / 2
  const diameter = size.value / (avgScale || 1)
  const borderColor = isEraser.value ? '#666666' : color.value
  cursorStyle.value = {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${diameter}px`,
    height: `${diameter}px`,
    borderRadius: '50%',
    border: `1px solid ${borderColor}`,
    backgroundColor: isEraser.value ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  }
}

function onPointerEnter(e) {
  cursorVisible.value = true
  updateCursor(e)
}

function onPointerDown(e) {
  if (props.readonly) return
  if (!ctx.value) return
  drawing.value = true
  try { canvasRef.value.setPointerCapture && canvasRef.value.setPointerCapture(e.pointerId) } catch (_) {}
  const p = getCanvasPoint(e)
  lastPoint.value = p
  pushEvent({ type: 'begin', x: p.x, y: p.y })
  updateCursor(e)
}

// 触摸事件回退（部分移动端不触发 Pointer 事件）
function touchToClient(t) {
  return { clientX: t.clientX, clientY: t.clientY }
}
function onTouchStart(ev) {
  if (props.readonly) return
  if (!ctx.value) return
  const t = ev.touches && ev.touches[0]
  if (!t) return
  drawing.value = true
  const p = getCanvasPoint(touchToClient(t))
  lastPoint.value = p
  pushEvent({ type: 'begin', x: p.x, y: p.y })
  updateCursor(touchToClient(t))
}
function onTouchMove(ev) {
  if (props.readonly) return
  const t = ev.touches && ev.touches[0]
  if (!t || !drawing.value || !ctx.value) return
  const p = getCanvasPoint(touchToClient(t))
  drawLine(lastPoint.value, p)
  pushEvent({ type: 'move', x: p.x, y: p.y })
  lastPoint.value = p
  updateCursor(touchToClient(t))
}
function onTouchEnd() {
  if (props.readonly) return
  if (!drawing.value) return
  drawing.value = false
  pushEvent({ type: 'end' })
  flushEvents()
  cursorVisible.value = false
}

function onPointerMove(e) {
  updateCursor(e)
  if (props.readonly) return
  if (!drawing.value || !ctx.value) return
  const p = getCanvasPoint(e)
  drawLine(lastPoint.value, p)
  pushEvent({ type: 'move', x: p.x, y: p.y })
  lastPoint.value = p
}

function onPointerUp(e) {
  if (props.readonly) return
  if (!drawing.value) return
  drawing.value = false
  try { canvasRef.value.releasePointerCapture && canvasRef.value.releasePointerCapture(e.pointerId) } catch (_) {}
  pushEvent({ type: 'end' })
  flushEvents()
}

function onPointerLeave() {
  cursorVisible.value = false
  if (props.readonly) return
  if (drawing.value) {
    drawing.value = false
    pushEvent({ type: 'end' })
    flushEvents()
  }
}

function exportBlob() {
  return new Promise((resolve) => {
    const canvas = canvasRef.value
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

onMounted(() => {
  const canvas = canvasRef.value
  ctx.value = canvas.getContext('2d')
  fillBackground()
  flushTimer = setInterval(flushEvents, 400)
})

onBeforeUnmount(() => {
  if (flushTimer) clearInterval(flushTimer)
})

defineExpose({
  exportBlob,
  clearCanvas,
})

watch(size, () => {
  if (cursorVisible.value) {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    updateCursor({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 })
  }
})
</script>

<style scoped>
canvas { touch-action: none; cursor: none; }
.pointer-circle { box-sizing: border-box; }
</style>