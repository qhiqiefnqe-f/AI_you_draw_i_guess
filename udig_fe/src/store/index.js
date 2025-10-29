import { defineStore } from 'pinia'
import socketManager from '@/plugins/socket.js'

// 简单的HTML转义，保持与后端一致的显示效果
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * 主应用状态管理
 * 管理用户信息、房间状态、消息等数据
 */
export const useStore = defineStore('app', {
  state: () => ({
    // 用户信息
    username: localStorage.getItem('username') || '',
    userId: null,
    socketConnected: false,

    // 房间相关
    rooms: [], // 房间列表 [{ id, name, count }]
    currentRoom: null, // 当前房间ID
    members: [], // 当前房间成员列表 [{id, name}]
    roomOwner: null, // 房主ID（从服务端广播）

    // 消息相关
    messages: [], // 消息列表 [{ from, text, time, type }]

    // UI状态
    loading: false,
    error: null,

    // 其他
    mutedIds: [], // 被静音的用户ID（仅前端UI）
    kickedInfo: null, // 被踢事件信息 { roomId, reason }

    // 语音相关
    voiceEnabledIds: [], // 当前在语音频道的成员ID
    speakingIds: [], // 正在说话的成员ID（含自己）
    inVoice: false, // 自己是否加入语音频道
    isMicMuted: false, // 自己是否静音（不发送音频）
    isDeaf: false, // 自己是否禁听（不播放音频）
    playVolume: 1.0, // 播放端全局音量 0~1
    localAudioStream: null, // 自己的本地音频流
    peerConnections: {}, // { [peerId]: RTCPeerConnection }
    voiceRemoteStreams: {}, // { [peerId]: MediaStream }
    vadNodes: {}, // { [peerId|'local']: { ctx, analyser, source, rafId } }

    // 传话模式
    telephone: {
      phase: 'idle',
      chainId: null,
      stepIndex: 0,
      deadline: null,
      assigneeId: null,
      playersOrder: [],
      descDraft: '',
      lastSubmit: null,
      answer: null, // 传话链的答案（题目）
      
      // 多链模式新增字段
      multiChain: false, // 是否为多链模式
      chains: {}, // 所有链的状态 { chainId: { ownerId, assigneeId } }
      myChainId: null, // 我拥有的链ID
      myAssigneeChainId: null, // 我当前需要处理的链ID
      submissionStats: { // 提交统计
        submissionCount: 0,
        totalPlayers: 0,
        allSubmitted: false
      },
      votes: {} // 投票数据 { [chainId]: { [userId]: true|false } }
    },

    // 房间配置
    roomConfig: {
      // 基础设置
      minPlayers: 2,
      maxPlayers: 8,
      
      // 时间设置
      drawingTime: 60,
      descriptionTime: 30,
      
      // 游戏模式设置
      oddPersonChainEnding: 'skip_last', // 'skip_last' | 'add_extra_round'
      
      // 词库设置
      wordLibrary: 'system', // 'system' | 'custom' | 'mixed'
      wordLibraryType: 'system', // 新增：词库类型
      selectedLibraries: [], // 新增：已选择的词库ID列表
      
      // 其他设置
      observerMode: false,
      contentFilter: false,
    },
  }),

  getters: {
    /**
     * 是否已连接并识别身份
     */
    isReady: (state) => state.socketConnected && state.username,

    /**
     * 是否在房间中
     */
    inRoom: (state) => !!state.currentRoom,

    /**
     * 是否为当前房间房主
     */
    isOwner: (state) => !!state.roomOwner && !!state.userId && state.roomOwner === state.userId,

    /**
     * 当前房间信息
     */
    currentRoomInfo: (state) => {
      if (!state.currentRoom) return null
      return state.rooms.find(room => room.id === state.currentRoom) || {
        id: state.currentRoom,
        name: state.currentRoom,
        count: state.members.length
      }
    },

    /**
     * 系统消息列表
     */
    systemMessages: (state) => state.messages.filter(msg => msg.type === 'system'),

    /**
     * 聊天消息列表
     */
    chatMessages: (state) => state.messages.filter(msg => msg.type === 'chat'),

    /**
     * 语音成员IDs
     */
    voiceMembers: (state) => state.voiceEnabledIds,
  },

  actions: {
    /**
     * 设置用户名并保存到本地存储
     */
    setUsername(username) {
      this.username = username
      localStorage.setItem('username', username)
    },

    /**
     * 设置错误信息
     */
    setError(error) {
      this.error = error
      if (error) {
        console.error('App Error:', error)
      }
    },

    /**
     * 清除错误信息
     */
    clearError() {
      this.error = null
    },

    /**
     * 初始化Socket连接
     */
    async connect(username) {
      try {
        this.loading = true
        this.clearError()
        console.log('[Store] connect start')

        if (username) {
          this.setUsername(username)
          console.log('[Store] setUsername:', username)
        }

        // 初始化socket
        socketManager.initSocket()
        console.log('[Store] initSocket done')

        // 绑定事件监听
        this.bindSocketEvents()
        console.log('[Store] bindSocketEvents done')

        // 连接到服务器
        await socketManager.connect()
        console.log('[Store] socket connected. id:', socketManager.getSocket()?.id)

        // 保存自身ID
        this.userId = socketManager.getSocketId()

        // 发送身份识别
        await socketManager.emit('identify', { username: this.username }, () => { })
        console.log('[Store] identify emitted for username:', this.username)

        this.socketConnected = true
        console.log('Connected and identified as:', this.username)

      } catch (error) {
        this.setError(`连接失败: ${error.message}`)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 断开连接
     */
    disconnect() {
      socketManager.disconnect()
      this.socketConnected = false
      this.currentRoom = null
      this.members = []
      this.messages = []
      this.rooms = []
      // 重置传话状态
      this.telephone = {
        phase: 'idle', chainId: null, stepIndex: 0, deadline: null, descDraft: '', lastSubmit: null,
      }
    },

    /**
     * 绑定Socket事件监听
     */
    bindSocketEvents() {
      const socket = socketManager.getSocket()
      if (!socket) return

      // 连接状态事件
      socket.on('connect', () => {
        this.socketConnected = true
        this.userId = socket.id
        this.clearError()
        console.log('[Store] socket on connect (listener) id:', this.userId)
      })

      socket.on('disconnect', () => {
        this.socketConnected = false
        this.setError('连接已断开，正在尝试重连...')
        console.log('[Store] socket on disconnect (listener)')
      })

      socket.on('connect_error', (error) => {
        this.socketConnected = false
        this.setError(`连接错误: ${error.message}`)
        console.log('[Store] socket connect_error (listener):', error?.message)
      })

      // 业务事件
      socket.on('chat-message', (message) => {
        console.log('[Store] on chat-message:', message)
        // 避免自身消息重复（已进行乐观更新）
        if ((message.fromId && message.fromId === this.userId) || (!message.fromId && message.from === this.username)) return
        this.addMessage({
          from: message.from,
          fromId: message.fromId,
          text: message.text,
          time: message.time,
          type: 'chat'
        })
      })

      socket.on('system-message', (data) => {
        console.log('[Store] on system-message:', data)
        this.addMessage({
          from: 'System',
          text: data.text,
          time: data.time,
          type: 'system'
        })
      })

      socket.on('room-members', (data) => {
        console.log('[Store] on room-members:', data)
        if (data.roomId === this.currentRoom) {
          this.members = Array.isArray(data.members) ? data.members : []
          this.roomOwner = data.owner || null
        }
      })

      socket.on('room-list', (rooms) => {
        console.log('[Store] on room-list:', rooms)
        this.rooms = rooms
      })

      // 语音成员广播
      socket.on('voice-members', (data) => {
        console.log('[Store] on voice-members:', data)
        if (data.roomId === this.currentRoom) {
          this.voiceEnabledIds = Array.isArray(data.members) ? data.members : []
          this.syncPeerConnections()
        }
      })

      // WebRTC 信令
      socket.on('rtc-offer', ({ roomId, fromId, sdp }) => {
        if (roomId !== this.currentRoom) return
        console.log('[Store] on rtc-offer from', fromId)
        this.handleOffer({ fromId, sdp })
      })
      socket.on('rtc-answer', ({ roomId, fromId, sdp }) => {
        if (roomId !== this.currentRoom) return
        console.log('[Store] on rtc-answer from', fromId)
        this.handleAnswer({ fromId, sdp })
      })
      socket.on('rtc-candidate', ({ roomId, fromId, candidate }) => {
        if (roomId !== this.currentRoom) return
        this.handleCandidate({ fromId, candidate })
      })

      // 被房主踢出
      socket.on('kicked', (data) => {
        console.log('[Store] on kicked:', data)
        this.kickedInfo = data
        // 清空房间相关状态
        this.currentRoom = null
        this.members = []
        this.roomOwner = null
        // 保留消息或清空，选择清空避免混淆
        this.messages = []
      })

      // 踢人错误提示
      socket.on('kick-error', (err) => {
        console.warn('[Store] on kick-error:', err)
        this.setError(err?.message || '踢人失败')
      })

      // 传话模式：阶段广播
      socket.on('telephone/phase', ({ phase, deadline, assigneeId, chainId, stepIndex, playersOrder, multiChain, chainAssignments }) => {
        console.log('[Store] on telephone/phase:', { phase, deadline, assigneeId, chainId, stepIndex, playersOrder, multiChain, chainAssignments })
        console.log('[Store] 当前阶段从', this.telephone.phase, '切换到', phase)
        
        this.telephone.phase = phase || 'idle'
        this.telephone.deadline = deadline || null
        if (typeof stepIndex !== 'undefined') this.telephone.stepIndex = Number(stepIndex) || 0
        if (Array.isArray(playersOrder)) this.telephone.playersOrder = playersOrder
        if (typeof multiChain !== 'undefined') this.telephone.multiChain = multiChain
        
        if (multiChain && chainAssignments) {
          // 多链模式：处理链分配
          this.telephone.chains = chainAssignments
          
          // 找到我拥有的链
          const myChain = Object.entries(chainAssignments).find(([chainId, chain]) => chain.ownerId === this.userId)
          this.telephone.myChainId = myChain ? myChain[0] : null
          
          // 找到我当前需要处理的链
          const assigneeChain = Object.entries(chainAssignments).find(([chainId, chain]) => chain.assigneeId === this.userId)
          this.telephone.myAssigneeChainId = assigneeChain ? assigneeChain[0] : null
          this.telephone.chainId = this.telephone.myAssigneeChainId // 兼容现有逻辑
          
          console.log('[Store] 多链模式状态更新:', {
            myChainId: this.telephone.myChainId,
            myAssigneeChainId: this.telephone.myAssigneeChainId,
            phase: this.telephone.phase,
            stepIndex: this.telephone.stepIndex
          })
          
        } else {
          // 单链模式：保持原有逻辑
          if (typeof assigneeId !== 'undefined') this.telephone.assigneeId = assigneeId
          if (typeof chainId !== 'undefined' && chainId) this.telephone.chainId = chainId
        }
      })

      // 传话模式：提交广播（画作或描述）
      socket.on('telephone/submit-broadcast', ({ chainId, stepIndex, type, from, multiChain, submissionCount, totalPlayers, allSubmitted }) => {
        console.log('[Store] on telephone/submit-broadcast:', { chainId, stepIndex, type, from, multiChain, submissionCount, totalPlayers, allSubmitted })
        
        // 映射广播类型到阶段，便于前端统一判断
        const phase = type === 'draw' ? 'drawing' : (type === 'desc' ? 'describing' : 'idle')
        this.telephone.lastSubmit = { chainId, stepIndex, type, phase, from, at: Date.now() }
        
        // 更新多链模式的提交统计
        if (multiChain && typeof submissionCount !== 'undefined') {
          this.telephone.submissionStats = {
            submissionCount: submissionCount || 0,
            totalPlayers: totalPlayers || 0,
            allSubmitted: allSubmitted || false
          }
        }
      })

      // 传话模式：投票广播
      socket.on('telephone/vote-broadcast', ({ roomId, chainId, voterId, pass, yesCount, noCount, totalPlayers, votes }) => {
        console.log('[Store] on telephone/vote-broadcast:', { chainId, voterId, pass, yesCount, noCount, totalPlayers, votes })
        if (!this.telephone.votes) this.telephone.votes = {}
        this.telephone.votes[chainId] = votes || {}
      })
    },

    /**
     * 加入房间
     */
    async joinRoom(roomId) {
      try {
        this.loading = true
        this.clearError()
        console.log('[Store] joinRoom start:', roomId)

        if (!this.socketConnected) {
          throw new Error('Socket未连接')
        }

        // 发送加入房间请求
        // 无ACK事件，避免Promise超时阻塞
        await socketManager.emit('join-room', { roomId }, () => { })
        console.log('[Store] join-room emitted:', roomId)

        // 设置当前房间
        this.currentRoom = roomId
        console.log('[Store] currentRoom set:', this.currentRoom)

        // 清空之前的消息
        this.messages = []
        console.log('[Store] messages cleared')

        console.log('Joined room:', roomId)

      } catch (error) {
        this.setError(`加入房间失败: ${error.message}`)
        throw error
      } finally {
        this.loading = false
        console.log('[Store] joinRoom finally. loading:', this.loading)
      }
    },

    /**
     * 离开房间
     */
    async leaveRoom() {
      try {
        if (!this.currentRoom) return

        this.loading = true
        this.clearError()

        // 发送离开房间请求
        await socketManager.emit('leave-room', { roomId: this.currentRoom }, () => { })

        // 清空房间相关状态
        this.currentRoom = null
        this.members = []
        this.messages = []
        this.roomOwner = null

        console.log('Left room')

      } catch (error) {
        this.setError(`离开房间失败: ${error.message}`)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 发送聊天消息
     */
    async sendMessage(text) {
      try {
        if (!this.currentRoom) {
          throw new Error('未在房间中')
        }

        if (!text || text.trim().length === 0) {
          throw new Error('消息不能为空')
        }

        if (text.length > 500) {
          throw new Error('消息长度不能超过500字符')
        }

        this.clearError()

        // 乐观更新：先显示本地消息（进行HTML转义以与服务端一致）
        const optimisticMessage = {
          from: this.username,
          fromId: this.userId,
          text: escapeHtml(text.trim()),
          time: Date.now(),
          type: 'chat'
        }
        this.addMessage(optimisticMessage)

        // 发送到服务器
        await socketManager.emit('chat-message', {
          roomId: this.currentRoom,
          text: text.trim()
        }, () => { })

        console.log('Message sent:', text)

      } catch (error) {
        this.setError(`发送消息失败: ${error.message}`)
        throw error
      }
    },

    /**
     * 获取房间列表
     */
    async getRoomList() {
      try {
        this.clearError()
        console.log('[Store] getRoomList start')

        if (!this.socketConnected) {
          throw new Error('Socket未连接')
        }

        // 请求房间列表，无ACK，通过监听 'room-list' 事件更新
        await socketManager.emit('get-room-list', {}, () => { })
        console.log('[Store] get-room-list emitted; awaiting server push via room-list')
        // 返回当前已缓存的房间列表（真实更新由socket事件驱动）

        return this.rooms

      } catch (error) {
        this.setError(`获取房间列表失败: ${error.message}`)
        throw error
      }
    },

    /**
     * 添加消息到列表
     */
    addMessage(message) {
      this.messages.push({
        ...message,
        id: Date.now() + Math.random(), // 简单的ID生成
        time: message.time || Date.now()
      })

      // 限制消息数量，避免内存溢出
      if (this.messages.length > 1000) {
        this.messages = this.messages.slice(-500)
      }
    },

    /**
     * 清空消息
     */
    clearMessages() {
      this.messages = []
    },

    // 切换静音状态（仅前端UI）
    toggleMute(userId) {
      if (!userId) return
      const idx = this.mutedIds.indexOf(userId)
      if (idx >= 0) {
        this.mutedIds.splice(idx, 1)
      } else {
        this.mutedIds.push(userId)
      }
    },

    // 房主踢出成员（按ID）
    async kickMember(userId) {
      try {
        if (!this.currentRoom) throw new Error('未在房间中')
        if (!this.isOwner) throw new Error('只有房主可以踢人')
        if (!userId || userId === this.roomOwner) throw new Error('不能踢出房主')

        await socketManager.emit('kick-member', {
          roomId: this.currentRoom,
          target: userId
        }, () => { })
      } catch (error) {
        this.setError(error.message)
        throw error
      }
    },

    /**
     * 生成随机房间ID
     */
    generateRoomId() {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substr(2, 5)
      return `room_${timestamp}_${random}`
    },

    /**
     * 创建并加入新房间
     */
    async createAndJoinRoom(roomId) {
      const id = roomId || this.generateRoomId()
      await this.joinRoom(id)
      return id
    },

    /**
     * 加入语音频道
     */
    async joinVoice() {
      try {
        if (!this.currentRoom) throw new Error('未在房间中')
        const audio = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        })
        this.localAudioStream = audio
        this.isMicMuted = false
        this.inVoice = true
        this.setupLocalVAD()
        await socketManager.emit('voice-join', { roomId: this.currentRoom }, () => { })
        this.syncPeerConnections()
      } catch (err) {
        this.setError(`加入语音失败: ${err.message}`)
        throw err
      }
    },

    /**
     * 退出语音频道
     */
    async leaveVoice() {
      try {
        if (!this.inVoice) return
        await socketManager.emit('voice-leave', { roomId: this.currentRoom }, () => { })
      } catch (_) {}
      try { this.localAudioStream?.getTracks()?.forEach(t => t.stop()) } catch (_) {}
      this.localAudioStream = null
      this.isMicMuted = false
      this.inVoice = false
      Object.keys(this.peerConnections).forEach(id => this.closePeerConnection(id))
      this.peerConnections = {}
      this.voiceRemoteStreams = {}
      this.teardownVAD('local')
      this.speakingIds = []
    },

    /**
     * 切换麦克风（仅停止发送）
     */
    toggleMic() {
      this.isMicMuted = !this.isMicMuted
      if (this.localAudioStream) {
        this.localAudioStream.getAudioTracks().forEach(track => {
          track.enabled = !this.isMicMuted
        })
      }
    },

    /**
     * 切换禁听（播放端）
     */
    toggleDeaf() {
      this.isDeaf = !this.isDeaf
    },

    /**
     * 设置播放端音量
     */
    setPlayVolume(vol) {
      const v = Math.max(0, Math.min(1, Number(vol) || 0))
      this.playVolume = v
    },

    /**
     * 创建 PeerConnection
     */
    createPeerConnection(targetId) {
      if (this.peerConnections[targetId]) return this.peerConnections[targetId]
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketManager.emit('rtc-candidate', { roomId: this.currentRoom, toId: targetId, candidate: e.candidate }, () => { })
        }
      }
      pc.ontrack = (e) => {
        const [stream] = e.streams
        if (stream) {
          this.voiceRemoteStreams[targetId] = stream
          this.setupRemoteVAD(targetId, stream)
        }
      }
      if (this.localAudioStream) {
        this.localAudioStream.getTracks().forEach(track => pc.addTrack(track, this.localAudioStream))
      }
      this.peerConnections[targetId] = pc
      return pc
    },

    /**
     * 关闭连接
     */
    closePeerConnection(targetId) {
      const pc = this.peerConnections[targetId]
      if (pc) {
        try { pc.ontrack = null; pc.onicecandidate = null; pc.close() } catch (_) {}
      }
      delete this.peerConnections[targetId]
      delete this.voiceRemoteStreams[targetId]
      this.teardownVAD(targetId)
      this.speakingIds = this.speakingIds.filter(id => id !== targetId)
    },

    /**
     * 同步与语音成员的连接
     */
    async syncPeerConnections() {
      if (!this.inVoice || !this.localAudioStream) return
      const peers = (this.voiceEnabledIds || []).filter(id => id && id !== this.userId)
      for (const id of peers) {
        if (!this.peerConnections[id]) {
          const pc = this.createPeerConnection(id)
          if ((this.userId || '') < (id || '')) {
            const offer = await pc.createOffer({ offerToReceiveAudio: true })
            await pc.setLocalDescription(offer)
            await socketManager.emit('rtc-offer', { roomId: this.currentRoom, toId: id, sdp: offer }, () => { })
          }
        }
      }
      Object.keys(this.peerConnections).forEach(id => { if (!peers.includes(id)) this.closePeerConnection(id) })
    },

    /**
     * 处理 Offer
     */
    async handleOffer({ fromId, sdp }) {
      if (!this.inVoice) return
      const pc = this.createPeerConnection(fromId)
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await socketManager.emit('rtc-answer', { roomId: this.currentRoom, toId: fromId, sdp: answer }, () => { })
    },

    /**
     * 处理 Answer
     */
    async handleAnswer({ fromId, sdp }) {
      const pc = this.peerConnections[fromId]
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    },

    /**
     * 处理 ICE 候选
     */
    async handleCandidate({ fromId, candidate }) {
      const pc = this.peerConnections[fromId]
      if (!pc) return
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch (e) { console.warn('addIceCandidate error:', e) }
    },

    /**
     * 本地 VAD
     */
    setupLocalVAD() {
      try {
        if (!this.localAudioStream) return
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const source = ctx.createMediaStreamSource(this.localAudioStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          analyser.getByteTimeDomainData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / dataArray.length)
          const speaking = rms > 0.04 && !this.isMicMuted
          const id = this.userId
          const has = this.speakingIds.includes(id)
          if (speaking && !has) this.speakingIds.push(id)
          if (!speaking && has) this.speakingIds = this.speakingIds.filter(x => x !== id)
          this.vadNodes['local'].rafId = requestAnimationFrame(loop)
        }
        this.vadNodes['local'] = { ctx, analyser, source, rafId: requestAnimationFrame(loop) }
      } catch (e) { console.warn('setupLocalVAD error:', e) }
    },

    /**
     * 远端 VAD
     */
    setupRemoteVAD(userId, stream) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          analyser.getByteTimeDomainData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / dataArray.length)
          const speaking = rms > 0.04 && !this.isDeaf
          const has = this.speakingIds.includes(userId)
          if (speaking && !has) this.speakingIds.push(userId)
          if (!speaking && has) this.speakingIds = this.speakingIds.filter(x => x !== userId)
          this.vadNodes[userId].rafId = requestAnimationFrame(loop)
        }
        this.vadNodes[userId] = { ctx, analyser, source, rafId: requestAnimationFrame(loop) }
      } catch (e) { console.warn('setupRemoteVAD error:', e) }
    },

    /**
     * 关闭 VAD
     */
    teardownVAD(key) {
      const node = this.vadNodes[key]
      if (!node) return
      try { cancelAnimationFrame(node.rafId) } catch (_) {}
      try { node.source.disconnect() } catch (_) {}
      try { node.ctx.close() } catch (_) {}
      delete this.vadNodes[key]
    },
    /**
     * 传话模式：初始化/设置当前链与步
     */
    telephoneInitChain(chainId) {
      const id = chainId || (crypto && crypto.randomUUID ? crypto.randomUUID() : `chain_${Date.now().toString(36)}`)
      this.telephone.chainId = id
      this.telephone.stepIndex = 0
      this.telephone.phase = 'drawing'
      this.telephone.deadline = null
      return id
    },

    telephoneSetStep(index) {
      this.telephone.stepIndex = Number(index) || 0
    },

    /**
     * 传话模式：广播阶段变化（房主或客户端触发）
     */
    async telephoneEmitPhase(phase, deadline, extras = {}) {
      if (!this.currentRoom) throw new Error('未在房间中')
      // 乐观更新：立即更新本地阶段与截止时间，避免仅依赖服务端广播
      this.telephone.phase = phase || 'idle'
      this.telephone.deadline = deadline || null
      const payload = { roomId: this.currentRoom, phase, deadline, ...extras }
      // 如果是开始阶段，包含playersOrder和多链模式标识
      if (phase === 'drawing' && this.telephone.playersOrder) {
        payload.playersOrder = this.telephone.playersOrder
        payload.multiChain = this.telephone.multiChain
      }
      await socketManager.emit('telephone/phase-change', payload, () => { })
    },

    // 传话链：房主开始游戏（新的游戏开始流程）
    async telephoneStartGame() {
      if (!this.currentRoom) { this.setError('未在房间中'); return }
      
      const ms = Array.isArray(this.members) ? this.members : []
      if (ms.length < 2) { this.setError('至少需要2名成员'); return }
      
      const order = ms.map(m => m.id)
      
      // 启用多链模式
      this.telephone.multiChain = true
      this.telephone.playersOrder = order
      this.telephone.stepIndex = 0
      this.telephone.phase = 'topic-selection'
      this.telephone.deadline = new Date(Date.now() + 30 * 1000) // 30秒选题时间
      
      // 广播进入题目选择阶段（多链模式）
      this.telephoneEmitPhase('topic-selection', this.telephone.deadline, { 
        stepIndex: 0,
        playersOrder: order,
        multiChain: true
      })
    },

    // 传话链：房主一键开始（支持偶数人数的传话链）
    telephoneStartChain() {
      if (!this.currentRoom) { this.setError('未在房间中'); return }
      let order = Array.isArray(this.telephone.playersOrder) ? this.telephone.playersOrder.filter(id => this.members.some(m => m.id === id)) : []
      
      // 如果没有设置顺序，使用所有成员
      if (order.length === 0) {
        const ms = Array.isArray(this.members) ? this.members : []
        if (ms.length < 2) { this.setError('至少需要2名成员'); return }
        order = ms.map(m => m.id)
      }
      
      // 检查是否为偶数人数
      if (order.length % 2 !== 0) { 
        this.setError('传话链需要偶数人数参与'); 
        return 
      }
      
      const chainId = this.telephoneInitChain()
      this.telephone.playersOrder = order
      this.telephone.assigneeId = order[0]
      this.telephone.stepIndex = 0
      const deadline = new Date(Date.now() + 120 * 1000)
      this.telephone.deadline = deadline
      this.telephone.phase = 'drawing'
      this.telephoneEmitPhase('drawing', deadline, { assigneeId: this.telephone.assigneeId, chainId, stepIndex: 0 })
    },

    // 传话链：推进到下一阶段（支持多链模式）
    telephoneNextStage() {
      if (!this.currentRoom) { this.setError('未初始化传话链'); return }
      const order = Array.isArray(this.telephone.playersOrder) ? this.telephone.playersOrder : []
      if (order.length < 2) { this.setError('链未设置参与者顺序'); return }
      
      const nextStep = (Number(this.telephone.stepIndex) || 0) + 1
      
      // 多链模式的游戏结束条件
      if (this.telephone.multiChain) {
        // 多链模式：每个玩家都会经历完整的传话链流程
        // 步骤：0(选题) -> 1(绘画) -> 2(描述) -> 3(绘画) -> 4(描述) -> ...
        // 游戏在所有玩家都完成一轮传话链后结束
        if (nextStep > order.length) {
          this.telephone.phase = 'idle'
          this.telephone.deadline = null
          this.telephoneEmitPhase('idle', null, { 
            stepIndex: nextStep, 
            multiChain: true,
            playersOrder: order
          })
          return
        }
      } else {
        // 单链模式保持原有逻辑
        if (!this.telephone.chainId) { this.setError('未初始化传话链'); return }
        if (order.length % 2 !== 0) { this.setError('传话链需要偶数人数参与'); return }
        
        if (nextStep > order.length) {
          this.telephone.phase = 'idle'
          this.telephone.deadline = null
          this.telephone.assigneeId = null
          this.telephoneEmitPhase('idle', null, { chainId: this.telephone.chainId, stepIndex: nextStep })
          return
        }
      }
      
      // 确定下一阶段
      let nextPhase
      let timeLimit
      
      if (this.telephone.phase === 'topic-selection') {
        // 题目选择后进入绘画阶段
        nextPhase = 'drawing'
        timeLimit = 60 * 1000 // 60秒绘画时间
      } else {
        // 根据步骤索引确定阶段：奇数步为绘画，偶数步为描述
        if (nextStep % 2 === 1) {
          nextPhase = 'drawing'
          timeLimit = 60 * 1000 // 60秒绘画时间
        } else {
          nextPhase = 'describing'
          timeLimit = 30 * 1000 // 30秒描述时间
        }
      }
      
      const nextDeadline = new Date(Date.now() + timeLimit)
      this.telephone.stepIndex = nextStep
      this.telephone.deadline = nextDeadline
      this.telephone.phase = nextPhase
      
      // 构建广播参数
      const emitExtras = { 
        stepIndex: nextStep,
        playersOrder: order
      }
      
      if (this.telephone.multiChain) {
        emitExtras.multiChain = true
      } else {
        // 单链模式需要计算下一个执行者
        const nextAssigneeIndex = nextStep % order.length
        const nextAssigneeId = order[nextAssigneeIndex]
        this.telephone.assigneeId = nextAssigneeId
        emitExtras.assigneeId = nextAssigneeId
        emitExtras.chainId = this.telephone.chainId
      }
      
      this.telephoneEmitPhase(nextPhase, nextDeadline, emitExtras)
    },

    // 保持向后兼容的四人链方法
    telephoneStartFourChain() {
      // 设置为4人顺序然后调用通用方法
      if (!this.currentRoom) { this.setError('未在房间中'); return }
      const ms = Array.isArray(this.members) ? this.members.slice(0, 4) : []
      if (ms.length < 4) { this.setError('至少需要4名成员'); return }
      this.telephone.playersOrder = ms.map(m => m.id)
      this.telephoneStartChain()
    },

    /**
     * 传话模式：发送绘画事件（批量）
     */
    async telephoneSendDrawEvents(events = []) {
      if (!this.currentRoom) { console.warn('绘画事件未发送：未在房间中'); return }
      if (!this.telephone.chainId) { console.warn('绘画事件未发送：传话链未初始化'); return }
      if (this.telephone.phase !== 'drawing') { console.warn('绘画事件未发送：当前非绘制阶段'); return }
      if (this.telephone.assigneeId && this.telephone.assigneeId !== this.userId) { console.warn('绘画事件未发送：当前非指派绘制者'); return }
      if (!Array.isArray(events) || events.length === 0) return
      const payload = {
        roomId: this.currentRoom,
        chainId: this.telephone.chainId,
        stepIndex: this.telephone.stepIndex,
        events
      }
      await socketManager.emit('telephone/draw-events', payload, () => { })
    },

    /**
     * 传话模式：提交描述
     */
    async telephoneSubmitDesc(text) {
      if (!this.currentRoom) throw new Error('未在房间中')
      if (!this.telephone.chainId) throw new Error('未初始化传话链')
      if (this.telephone.phase !== 'describing') { console.warn('当前非描述阶段'); return }
      if (this.telephone.assigneeId && this.telephone.assigneeId !== this.userId) { console.warn('当前非指派描述者'); return }
      const data = { text: String(text || '').trim() }
      await socketManager.emit('telephone/submit', {
        roomId: this.currentRoom,
        chainId: this.telephone.chainId,
        stepIndex: this.telephone.stepIndex,
        type: 'desc',
        data
      }, () => { })
      this.telephone.lastSubmit = { chainId: this.telephone.chainId, stepIndex: this.telephone.stepIndex, type: 'desc', from: this.userId, at: Date.now() }
    },

    /**
     * 传话模式：投票（是否符合题目）
     */
    async telephoneVote(chainId, pass) {
      if (!this.currentRoom) throw new Error('未在房间中')
      await socketManager.emit('telephone/vote', { roomId: this.currentRoom, chainId, pass: !!pass }, () => {})
    },

    /**
     * 传话模式：上传图片并标记提交
     */
    async telephoneUploadImage(file) {
      if (!this.currentRoom) throw new Error('未在房间中')
      if (!this.telephone.chainId) throw new Error('未初始化传话链')
      if (!file) throw new Error('未选择图片文件')
      const API_BASE = socketManager.getServerUrl ? socketManager.getServerUrl() : 'http://localhost:3001'
      const fd = new FormData()
      fd.append('image', file)
      fd.append('roomId', this.currentRoom)
      fd.append('chainId', this.telephone.chainId)
      fd.append('stepIndex', String(this.telephone.stepIndex))
      const resp = await fetch(`${API_BASE}/api/telephone/upload`, { method: 'POST', body: fd })
      if (!resp.ok) throw new Error('上传失败')
      const data = await resp.json()
      // 标记提交（类型 draw）
      await socketManager.emit('telephone/submit', {
        roomId: this.currentRoom,
        chainId: this.telephone.chainId,
        stepIndex: this.telephone.stepIndex,
        type: 'draw',
        data: { imageUrl: data.imageUrl }
      }, () => { })
      this.telephone.lastSubmit = { chainId: this.telephone.chainId, stepIndex: this.telephone.stepIndex, type: 'draw', from: this.userId, at: Date.now() }
      return data
    },

    /**
     * HTTP 拉取：链列表
     */
    async fetchTelephoneChains(roomId) {
      const API_BASE = socketManager.getServerUrl ? socketManager.getServerUrl() : 'http://localhost:3001'
      const resp = await fetch(`${API_BASE}/api/telephone/chains/${encodeURIComponent(roomId || this.currentRoom)}`)
      if (!resp.ok) throw new Error('拉取链列表失败')
      return resp.json()
    },

    /**
     * HTTP 拉取：链详细（步摘要）
     */
    async fetchTelephoneChain(roomId, chainId) {
      const API_BASE = socketManager.getServerUrl ? socketManager.getServerUrl() : 'http://localhost:3001'
      const resp = await fetch(`${API_BASE}/api/telephone/chain/${encodeURIComponent(roomId || this.currentRoom)}/${encodeURIComponent(chainId || this.telephone.chainId)}`)
      if (!resp.ok) throw new Error('拉取链失败')
      return resp.json()
    },

    /**
     * HTTP 拉取：步详情
     */
    async fetchTelephoneStep(roomId, chainId, stepIndex) {
      const API_BASE = socketManager.getServerUrl ? socketManager.getServerUrl() : 'http://localhost:3001'
      const resp = await fetch(`${API_BASE}/api/telephone/step/${encodeURIComponent(roomId || this.currentRoom)}/${encodeURIComponent(chainId || this.telephone.chainId)}/${encodeURIComponent(typeof stepIndex === 'number' ? stepIndex : this.telephone.stepIndex)}`)
      if (!resp.ok) throw new Error('拉取步失败')
      return resp.json()
    },

    /**
     * HTTP 拉取：绘画事件
     */
    async fetchTelephoneEvents(roomId, chainId, stepIndex) {
      const API_BASE = socketManager.getServerUrl ? socketManager.getServerUrl() : 'http://localhost:3001'
      const resp = await fetch(`${API_BASE}/api/telephone/events/${encodeURIComponent(roomId || this.currentRoom)}/${encodeURIComponent(chainId || this.telephone.chainId)}/${encodeURIComponent(typeof stepIndex === 'number' ? stepIndex : this.telephone.stepIndex)}`)
      if (!resp.ok) throw new Error('拉取事件失败')
      return resp.json()
    },

    /**
     * 房间配置：更新配置
     */
    updateRoomConfig(config) {
      this.roomConfig = { ...this.roomConfig, ...config }
    },

    /**
     * 房间配置：重置为默认配置
     */
    resetRoomConfig() {
      this.roomConfig = {
        minPlayers: 2,
        maxPlayers: 8,
        drawingTime: 60,
        descriptionTime: 30,
        oddPersonChainEnding: 'skip_last',
        wordLibrary: 'system',
        wordLibraryType: 'system',
        selectedLibraries: [],
        observerMode: false,
        contentFilter: false,
      }
    },

    /**
     * 房间配置：保存配置到服务器
     */
    async saveRoomConfig(config) {
      try {
        if (!this.currentRoom) throw new Error('未在房间中')
        if (!this.isOwner) throw new Error('只有房主可以修改配置')
        
        // 验证词库选择
        if (config.wordLibraryType === 'system' && (!config.selectedLibraries || config.selectedLibraries.length === 0)) {
          throw new Error('使用系统内置词库时，请至少选择一个词库分类')
        }
        
        // 更新本地配置
        this.updateRoomConfig(config)
        
        // 发送配置到服务器
        await socketManager.emit('room-config-update', {
          roomId: this.currentRoom,
          config: this.roomConfig
        }, () => {})
        
        console.log('房间配置已保存:', this.roomConfig)
      } catch (error) {
        this.setError(`保存配置失败: ${error.message}`)
        throw error
      }
    },
  },
})