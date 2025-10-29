import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/App.vue'

// 导入UnoCSS
import 'virtual:uno.css'

// 导入自定义样式
import './styles/main.css'

// 导入页面组件
import Lobby from '@/pages/Lobby.vue'
import Room from '@/pages/Room.vue'
// 懒加载传话模式页面，避免首屏体积增大
const TelephoneMode = () => import('@/pages/TelephoneMode.vue')

// 创建路由配置
const routes = [
  {
    path: '/',
    name: 'Lobby',
    component: Lobby,
    meta: {
      title: '大厅 - 你画我猜',
      hasErrorHandler: true
    }
  },
  {
    path: '/room/:id',
    name: 'Room',
    component: Room,
    meta: {
      title: '房间 - 你画我猜',
      hasErrorHandler: true
    }
  },
  {
    path: '/telephone',
    name: 'Telephone',
    component: TelephoneMode,
    meta: {
      title: '传话模式 - 你画我猜',
      hasErrorHandler: true
    }
  },
  {
    // 404 重定向到大厅
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 更新页面标题
router.beforeEach((to, from, next) => {
  console.log('[Router] beforeEach title/update. from:', from.fullPath, 'to:', to.fullPath)
  // 更新页面标题
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }

  next()
})

// 路由守卫 - 房间页面权限检查
router.beforeEach((to, from, next) => {
  console.log('[Router] beforeEach guard. from:', from.fullPath, 'to:', to.fullPath)
  // 如果是房间页面，检查是否已连接
  if (to.name === 'Room') {
    // 这里可以添加权限检查逻辑
    // 由于store可能还未初始化，实际检查在Room.vue组件中进行
  }

  next()
})

// 创建Pinia实例
const pinia = createPinia()

// 创建Vue应用实例
const app = createApp(App)

// 注册插件
app.use(pinia)
app.use(router)

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('全局错误:', err)
  console.error('错误信息:', info)

  // 可以在这里添加错误上报逻辑
  // 例如发送到错误监控服务
}

// 全局警告处理
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Vue警告:', msg)
  console.warn('组件追踪:', trace)
}

// 挂载应用
app.mount('#app')

// 开发环境下的调试信息
if (import.meta.env.DEV) {
  console.log('🚀 应用已启动 - 开发模式')
  console.log('📍 当前路由:', router.currentRoute.value.path)

  // 暴露一些调试工具到全局
  window.__APP__ = app
  window.__ROUTER__ = router
  window.__PINIA__ = pinia
}
