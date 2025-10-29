import { io } from 'socket.io-client'

/**
 * Socket.IO 客户端单例封装
 * 提供统一的 socket 连接管理和事件处理
 */
class SocketManager {
  constructor() {
    this.socket = null
    this.isConnected = false
    // 默认后端地址，可通过 VITE_BE_URL 覆盖
    this.serverUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BE_URL) || 'http://localhost:3001'
  }

  /**
   * 初始化 Socket 连接
   * @param {string} serverUrl - 服务器地址
   * @returns {Promise<Socket>} Socket 实例
   */
  initSocket(serverUrl = this.serverUrl) {
    if (this.socket) {
      console.warn('Socket already initialized')
      return this.socket
    }

    this.serverUrl = serverUrl
    console.log('[Socket] initSocket with serverUrl:', this.serverUrl)
    this.socket = io(serverUrl, {
      autoConnect: false, // 手动控制连接
      // 优先使用轮询，连接成功后再尝试升级到 WebSocket，避免初始握手失败
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      // 提高连接与重连稳定性
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })

    // 连接事件监听
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id)
      this.isConnected = true
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.isConnected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.isConnected = false
    })

    // 重连相关日志（便于排障）
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('[Socket] reconnect_attempt:', attempt)
    })
    this.socket.on('reconnect', (attempt) => {
      console.log('[Socket] reconnect success after attempts:', attempt)
    })
    this.socket.on('reconnect_error', (err) => {
      console.warn('[Socket] reconnect_error:', err?.message || err)
    })
    this.socket.on('reconnect_failed', () => {
      console.warn('[Socket] reconnect_failed')
    })

    return this.socket
  }

  /**
   * 获取当前后端地址
   * @returns {string} serverUrl
   */
  getServerUrl() {
    return this.serverUrl
  }

  /**
   * 获取 Socket 实例
   * @returns {Socket|null} Socket 实例
   */
  getSocket() {
    if (!this.socket) {
      console.warn('Socket not initialized. Call initSocket() first.')
      return null
    }
    return this.socket
  }

  /**
   * 连接到服务器
   * @returns {Promise<void>}
   */
  connect() {
    if (!this.socket) {
      throw new Error('Socket not initialized. Call initSocket() first.')
    }

    if (this.isConnected) {
      console.warn('Socket already connected')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      console.log('[Socket] connecting to', this.serverUrl)
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000)

      this.socket.once('connect', () => {
        clearTimeout(timeout)
        resolve()
      })

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      this.socket.connect()
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.isConnected = false
    }
  }

  /**
   * 监听事件
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized. Call initSocket() first.')
      return
    }
    this.socket.on(event, callback)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.socket) {
      console.warn('Socket not initialized. Call initSocket() first.')
      return
    }
    this.socket.off(event, callback)
  }

  /**
   * 发出事件（带回调）
   * @param {string} event
   * @param {any} payload
   * @param {Function} [ack]
   */
  emit(event, payload, ack) {
    if (!this.socket) {
      console.warn('Socket not initialized. Call initSocket() first.')
      return
    }
    
    console.log(`[SocketManager] emit ${event}:`, payload)
    
    if (typeof ack === 'function') {
      this.socket.emit(event, payload, ack)
    } else {
      this.socket.emit(event, payload)
    }
  }

  /**
   * 检查连接状态
   * @returns {boolean} 是否已连接
   */
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected
  }

  /**
   * 获取 Socket ID
   * @returns {string|null} Socket ID
   */
  getSocketId() {
    return this.socket ? this.socket.id : null
  }
}

export default new SocketManager()