const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// 引入路由
const routes = require('./routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 静态文件服务：上传的图片
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// 使用路由
app.use('/api', routes);

// 上传配置（内存存储，限制 5MB）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/webp', 'image/jpeg'].includes(file.mimetype);
    cb(ok ? null : new Error('INVALID_FILE_TYPE'), ok);
  }
});

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (_) {}
}

function appendJsonl(filePath, records) {
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFile(filePath, lines, (err) => { if (err) console.error('appendJsonl error:', err); });
}

// 上传绘画图片（Telephone 模式）
app.post('/api/telephone/upload', upload.single('image'), async (req, res) => {
  try {
    const { roomId, chainId, stepIndex, playerId } = req.body || {};
    if (!roomId || !chainId || typeof stepIndex === 'undefined') {
      return res.status(400).json({ ok: false, error: 'MISSING_FIELDS' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: 'NO_FILE' });
    }

    const baseDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(chainId), 'steps', String(stepIndex));
    ensureDir(baseDir);

    const buffer = req.file.buffer;
    const img = sharp(buffer);
    let meta = null;
    try { meta = await img.metadata(); } catch (_) {}

    // 首选 WebP，失败则回退 PNG
    let outPath = path.join(baseDir, 'image.webp');
    let format = 'webp';
    try {
      await img.webp({ quality: 80 }).toFile(outPath);
    } catch (e) {
      console.warn('webp convert failed, fallback to png:', e?.message);
      outPath = path.join(baseDir, 'image.png');
      format = 'png';
      await sharp(buffer).png().toFile(outPath);
    }

    // 写入简单的元信息
    const metaPath = path.join(baseDir, 'meta.json');
    const metaData = {
      format,
      width: meta?.width || null,
      height: meta?.height || null,
      uploadedAt: Date.now(),
      roomId, chainId, stepIndex, playerId: playerId || null
    };
    fs.writeFile(metaPath, JSON.stringify(metaData, null, 2), (err) => { if (err) console.error('write meta error:', err); });

    const rel = outPath.split(path.join(__dirname, '..'))[1].replace(/\\+/g, '/');
    return res.json({ ok: true, url: '/uploads' + rel, format, ...metaData });
  } catch (err) {
    console.error('telephone upload error:', err);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// 内存数据结构 - 房间管理
const rooms = {};
// rooms 结构: { 
//   [roomId]: { 
//     name: string, 
//     clients: { [socketId]: { username, joinedAt } }, 
//     createdAt: Date,
//     owner: string | null
//   } 
// }

// 工具函数 - HTML转义，防止XSS攻击
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// 工具函数 - 获取房间列表
function getRoomList() {
  return Object.keys(rooms).map(roomId => ({
    id: roomId,
    name: rooms[roomId].name,
    count: Object.keys(rooms[roomId].clients).length,
    owner: rooms[roomId].owner || null
  }));
}

// 工具函数 - 获取房间成员列表
function getRoomMembers(roomId) {
  if (!rooms[roomId]) return [];
  return Object.entries(rooms[roomId].clients).map(([sid, client]) => ({ id: sid, name: client.username }));
}

// 工具函数 - 广播系统消息
function broadcastSystemMessage(roomId, text) {
  const message = {
    roomId,
    text,
    time: Date.now()
  };
  io.to(roomId).emit('system-message', message);
}

// 工具函数 - 广播房间成员更新
function broadcastRoomMembers(roomId) {
  const members = getRoomMembers(roomId);
  io.to(roomId).emit('room-members', {
    roomId,
    members,
    owner: rooms[roomId]?.owner || null
  });
}

// 语音成员列表工具
function getVoiceMembers(roomId) {
  if (!rooms[roomId] || !rooms[roomId].voiceMembers) return [];
  return Array.from(rooms[roomId].voiceMembers);
}

function broadcastVoiceMembers(roomId) {
  const members = getVoiceMembers(roomId);
  io.to(roomId).emit('voice-members', { roomId, members });
}

// 工具函数 - 广播房间列表更新
function broadcastRoomList() {
  const roomList = getRoomList();
  io.emit('room-list', roomList);
}

// 基础路由
app.get('/', (req, res) => {
  res.json({ message: 'You Draw I Guess API Server' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Telephone Mode - retrieval APIs (no DB, file-based)
app.get('/api/telephone/chains/:roomId', (req, res) => {
  const { roomId } = req.params;
  try {
    const chainsDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains');
    let chains = [];
    if (fs.existsSync(chainsDir)) {
      const dirs = fs.readdirSync(chainsDir, { withFileTypes: true });
      chains = dirs.filter(d => d.isDirectory()).map(d => d.name).map(chainId => {
        const stepsDir = path.join(chainsDir, chainId, 'steps');
        let stepsCount = 0;
        let lastUpdated = null;
        if (fs.existsSync(stepsDir)) {
          const stepDirs = fs.readdirSync(stepsDir, { withFileTypes: true }).filter(s => s.isDirectory());
          stepsCount = stepDirs.length;
          stepDirs.forEach(s => {
            const sPath = path.join(stepsDir, s.name);
            const stat = fs.statSync(sPath);
            lastUpdated = Math.max(lastUpdated || 0, stat.mtimeMs);
          });
        }
        return { chainId, steps: stepsCount, lastUpdated };
      });
    }
    res.json({ ok: true, roomId, chains });
  } catch (err) {
    console.error('list chains error:', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

app.get('/api/telephone/chain/:roomId/:chainId', (req, res) => {
  const { roomId, chainId } = req.params;
  console.log(`[后端调试] 获取链数据请求: roomId=${roomId}, chainId=${chainId}`);
  
  try {
    const stepsDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(chainId), 'steps');
    console.log(`[后端调试] 步骤目录路径: ${stepsDir}`);
    console.log(`[后端调试] 步骤目录是否存在: ${fs.existsSync(stepsDir)}`);
    
    const result = [];
    let answer = null; // 添加答案字段
    
    if (fs.existsSync(stepsDir)) {
      const stepDirs = fs.readdirSync(stepsDir, { withFileTypes: true }).filter(s => s.isDirectory()).map(s => s.name);
      console.log(`[后端调试] 找到的步骤目录: ${JSON.stringify(stepDirs)}`);
      
      stepDirs.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      console.log(`[后端调试] 排序后的步骤目录: ${JSON.stringify(stepDirs)}`);
      
      for (const stepIndex of stepDirs) {
        const base = path.join(stepsDir, stepIndex);
        const metaPath = path.join(base, 'meta.json');
        const descPath = path.join(base, 'desc.json');
        const submitPath = path.join(base, 'submit.json');
        const answerPath = path.join(base, 'answer.json'); // 添加答案文件路径
        const webpPath = path.join(base, 'image.webp');
        const pngPath = path.join(base, 'image.png');
        const eventsPath = path.join(base, 'events.jsonl');
        
        console.log(`[后端调试] 处理步骤 ${stepIndex}:`);
        console.log(`  - 答案文件存在: ${fs.existsSync(answerPath)}`);
        console.log(`  - 描述文件存在: ${fs.existsSync(descPath)}`);
        console.log(`  - 提交文件存在: ${fs.existsSync(submitPath)}`);
        console.log(`  - WebP图片存在: ${fs.existsSync(webpPath)}`);
        console.log(`  - PNG图片存在: ${fs.existsSync(pngPath)}`);
        console.log(`  - 事件文件存在: ${fs.existsSync(eventsPath)}`);
        
        let meta = null;
        try { if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (_) {}
        
        // 读取答案（通常在第0步）
        if (stepIndex === '0' && fs.existsSync(answerPath)) {
          try {
            const answerData = JSON.parse(fs.readFileSync(answerPath, 'utf-8'));
            answer = answerData.answer;
            console.log(`[后端调试] 读取到原始答案: ${answer}`);
          } catch (e) {
            console.log(`[后端调试] 读取答案文件失败: ${e.message}`);
          }
        }
        
        const hasDesc = fs.existsSync(descPath);
        const hasSubmit = fs.existsSync(submitPath);
        const hasWebp = fs.existsSync(webpPath);
        const hasPng = fs.existsSync(pngPath);
        const hasEvents = fs.existsSync(eventsPath);
        const imageUrl = hasWebp ? `/uploads/rooms/${roomId}/chains/${chainId}/steps/${stepIndex}/image.webp` : (hasPng ? `/uploads/rooms/${roomId}/chains/${chainId}/steps/${stepIndex}/image.png` : null);
        
        // 修复步骤类型判断逻辑：优先根据事件文件判断绘画步骤
        let stepType;
        if (hasEvents) {
          stepType = 'draw'; // 有事件文件说明是绘画步骤
        } else if (hasDesc) {
          stepType = 'desc'; // 只有描述文件且无事件文件才是描述步骤
        } else {
          stepType = 'draw'; // 默认为绘画步骤
        }
        
        const stepData = {
          stepIndex: parseInt(stepIndex, 10),
          imageUrl,
          meta,
          type: stepType,
          hasSubmit,
          hasEvents
        };
        
        console.log(`[后端调试] 步骤 ${stepIndex} 类型判断: hasEvents=${hasEvents}, hasDesc=${hasDesc}, type=${stepType}`);
        
        console.log(`[后端调试] 步骤 ${stepIndex} 数据: ${JSON.stringify(stepData)}`);
        result.push(stepData);
      }
    } else {
      console.log(`[后端调试] 步骤目录不存在，返回空结果`);
    }
    
    const responseData = { ok: true, roomId, chainId, steps: result, answer };
    console.log(`[后端调试] 返回链数据: ${JSON.stringify(responseData, null, 2)}`);
    res.json(responseData); // 返回答案
  } catch (err) {
    console.error('[后端调试] get chain error:', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

app.get('/api/telephone/step/:roomId/:chainId/:stepIndex', (req, res) => {
  const { roomId, chainId, stepIndex } = req.params;
  console.log(`[后端调试] 获取步骤数据请求: roomId=${roomId}, chainId=${chainId}, stepIndex=${stepIndex}`);
  
  try {
    const base = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(chainId), 'steps', String(stepIndex));
    console.log(`[后端调试] 步骤基础路径: ${base}`);
    
    const metaPath = path.join(base, 'meta.json');
    const descPath = path.join(base, 'desc.json');
    const submitPath = path.join(base, 'submit.json');
    const webpPath = path.join(base, 'image.webp');
    const pngPath = path.join(base, 'image.png');
    const eventsPath = path.join(base, 'events.jsonl');
    
    console.log(`[后端调试] 文件存在性检查:`);
    console.log(`  - meta.json: ${fs.existsSync(metaPath)}`);
    console.log(`  - desc.json: ${fs.existsSync(descPath)}`);
    console.log(`  - submit.json: ${fs.existsSync(submitPath)}`);
    console.log(`  - image.webp: ${fs.existsSync(webpPath)}`);
    console.log(`  - image.png: ${fs.existsSync(pngPath)}`);
    console.log(`  - events.jsonl: ${fs.existsSync(eventsPath)}`);
    
    const payload = {
      ok: true,
      roomId,
      chainId,
      stepIndex: parseInt(stepIndex, 10),
      meta: null,
      imageUrl: null,
      desc: null,
      submit: null,
      eventsCount: null
    };
    
    try { 
      if (fs.existsSync(metaPath)) {
        payload.meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        console.log(`[后端调试] 读取到meta数据: ${JSON.stringify(payload.meta)}`);
      }
    } catch (e) {
      console.log(`[后端调试] 读取meta文件失败: ${e.message}`);
    }
    
    if (fs.existsSync(webpPath)) {
      payload.imageUrl = `/uploads/rooms/${roomId}/chains/${chainId}/steps/${stepIndex}/image.webp`;
      console.log(`[后端调试] 使用WebP图片: ${payload.imageUrl}`);
    } else if (fs.existsSync(pngPath)) {
      payload.imageUrl = `/uploads/rooms/${roomId}/chains/${chainId}/steps/${stepIndex}/image.png`;
      console.log(`[后端调试] 使用PNG图片: ${payload.imageUrl}`);
    } else {
      console.log(`[后端调试] 没有找到图片文件`);
    }
    
    try { 
      if (fs.existsSync(descPath)) {
        payload.desc = JSON.parse(fs.readFileSync(descPath, 'utf-8'));
        console.log(`[后端调试] 读取到描述数据: ${JSON.stringify(payload.desc)}`);
      }
    } catch (e) {
      console.log(`[后端调试] 读取描述文件失败: ${e.message}`);
    }
    
    try { 
      if (fs.existsSync(submitPath)) {
        payload.submit = JSON.parse(fs.readFileSync(submitPath, 'utf-8'));
        console.log(`[后端调试] 读取到提交数据: ${JSON.stringify(payload.submit)}`);
      }
    } catch (e) {
      console.log(`[后端调试] 读取提交文件失败: ${e.message}`);
    }
    
    if (fs.existsSync(eventsPath)) {
      try { 
        const eventsContent = fs.readFileSync(eventsPath, 'utf-8');
        payload.eventsCount = eventsContent.split('\n').filter(Boolean).length;
        console.log(`[后端调试] 事件文件行数: ${payload.eventsCount}`);
      } catch (e) {
        console.log(`[后端调试] 读取事件文件失败: ${e.message}`);
      }
    }
    
    console.log(`[后端调试] 返回步骤数据: ${JSON.stringify(payload, null, 2)}`);
    res.json(payload);
  } catch (err) {
    console.error('[后端调试] get step error:', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// Room snapshots via HTTP
app.get('/api/rooms', (req, res) => {
  try {
    res.json({ ok: true, rooms: getRoomList() });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  try {
    const members = getRoomMembers(roomId);
    const voiceMembers = getVoiceMembers(roomId);
    res.json({ ok: true, roomId, members, owner: rooms[roomId]?.owner || null, voiceMembers });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// Events reader (returns array, small files recommended)
app.get('/api/telephone/events/:roomId/:chainId/:stepIndex', (req, res) => {
  const { roomId, chainId, stepIndex } = req.params;
  console.log(`[后端调试] 获取事件数据请求: roomId=${roomId}, chainId=${chainId}, stepIndex=${stepIndex}`);
  
  try {
    const eventsPath = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(chainId), 'steps', String(stepIndex), 'events.jsonl');
    console.log(`[后端调试] 事件文件路径: ${eventsPath}`);
    console.log(`[后端调试] 事件文件是否存在: ${fs.existsSync(eventsPath)}`);
    
    if (!fs.existsSync(eventsPath)) {
      console.log(`[后端调试] 事件文件不存在，返回空数组`);
      return res.json({ ok: true, events: [] });
    }
    
    const lines = fs.readFileSync(eventsPath, 'utf-8').split('\n').filter(Boolean);
    console.log(`[后端调试] 事件文件总行数: ${lines.length}`);
    
    const events = lines.map(line => { 
      try { 
        return JSON.parse(line); 
      } catch (e) { 
        console.log(`[后端调试] 解析事件行失败: ${e.message}, 行内容: ${line}`);
        return null; 
      } 
    }).filter(Boolean);
    
    console.log(`[后端调试] 成功解析的事件数量: ${events.length}`);
    console.log(`[后端调试] 前3个事件示例: ${JSON.stringify(events.slice(0, 3))}`);
    
    res.json({ ok: true, events });
  } catch (err) {
    console.error('[后端调试] read events error:', err);
    res.status(500).json({ ok: false, error: 'SERVER_ERROR' });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 初始化socket数据
  socket.data = { username: '匿名用户' };

  // 1. 用户身份识别
  socket.on('identify', (payload) => {
    const { username } = payload;
    if (username && typeof username === 'string' && username.trim()) {
      socket.data.username = escapeHtml(username.trim().substring(0, 50)); // 限制用户名长度
      console.log(`用户 ${socket.id} 设置用户名: ${socket.data.username}`);
    }
  });

  // 2. 加入房间
  socket.on('join-room', (payload) => {
    const { roomId } = payload;
    if (!roomId || typeof roomId !== 'string') return;

    // 如果房间不存在，创建房间
    if (!rooms[roomId]) {
      rooms[roomId] = {
        name: roomId, // 简单实现，使用roomId作为房间名
        clients: {},
        voiceMembers: new Set(),
        createdAt: new Date(),
        owner: null
      };
      console.log(`创建新房间: ${roomId}`);
    }

    // 加入Socket.IO房间
    socket.join(roomId);

    // 在内存中记录用户
    rooms[roomId].clients[socket.id] = {
      username: socket.data.username,
      joinedAt: new Date()
    };

    // 如果尚未设置房主，则当前加入者为房主
    if (!rooms[roomId].owner) {
      rooms[roomId].owner = socket.id;
      broadcastSystemMessage(roomId, `房主为 ${socket.data.username}`);
    }

    console.log(`用户 ${socket.data.username} (${socket.id}) 加入房间 ${roomId}`);

    // 广播系统消息
    broadcastSystemMessage(roomId, `${socket.data.username} 加入了房间`);

    // 广播房间成员更新（包含房主）
    broadcastRoomMembers(roomId);

    // 广播房间列表更新
    broadcastRoomList();
  });

  // 3. 发送聊天消息
  socket.on('chat-message', (payload) => {
    const { roomId, text } = payload;
    if (!roomId || !text || typeof text !== 'string') return;

    // 检查用户是否在房间中
    if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) return;

    // 文本处理：限制长度并转义HTML
    const cleanText = escapeHtml(text.trim().substring(0, 1000));
    if (!cleanText) return;

    // 构造消息对象
    const message = {
      from: socket.data.username,
      fromId: socket.id,
      text: cleanText,
      time: Date.now(),
      type: 'chat'
    };

    // 广播到房间
    io.to(roomId).emit('chat-message', message);
    console.log(`房间 ${roomId} 收到消息 from ${socket.data.username}: ${cleanText}`);
  });

  // 4. 离开房间
  socket.on('leave-room', (payload) => {
    const { roomId } = payload;
    if (!roomId || !rooms[roomId]) return;

    // 离开Socket.IO房间
    socket.leave(roomId);

    // 从内存中移除用户
    if (rooms[roomId].clients[socket.id]) {
      const leavingUsername = rooms[roomId].clients[socket.id].username;
      delete rooms[roomId].clients[socket.id];
      console.log(`用户 ${socket.data.username} (${socket.id}) 离开房间 ${roomId}`);

      // 如果离开的用户是房主，进行房主转移
      if (rooms[roomId].owner === socket.id) {
        const remainingIds = Object.keys(rooms[roomId].clients);
        rooms[roomId].owner = remainingIds[0] || null;
        if (rooms[roomId].owner) {
          const newOwnerName = rooms[roomId].clients[rooms[roomId].owner]?.username || '未知';
          broadcastSystemMessage(roomId, `房主变更为 ${newOwnerName}`);
        }
      }

      // 广播系统消息
      broadcastSystemMessage(roomId, `${socket.data.username} 离开了房间`);

      // 广播房间成员更新
      // 同步语音成员列表
      rooms[roomId]?.voiceMembers?.delete(socket.id);
      broadcastRoomMembers(roomId);
      broadcastVoiceMembers(roomId);
    }

    // 如果房间为空，删除房间
    if (Object.keys(rooms[roomId].clients).length === 0) {
      delete rooms[roomId];
      console.log(`删除空房间: ${roomId}`);
      // 广播房间列表更新
      broadcastRoomList();
    } else {
      broadcastRoomList();
    }
  });

  // 5. 获取房间列表
  socket.on('get-room-list', () => {
    const roomList = getRoomList();
    socket.emit('room-list', roomList);
  });

  // Telephone 模式：绘画事件（33ms节流由前端完成，这里直接落盘）
  socket.on('telephone/draw-events', (payload) => {
    try {
      const { roomId, chainId, stepIndex, events } = payload || {};
      if (!roomId || !chainId || typeof stepIndex === 'undefined' || !Array.isArray(events)) return;
      if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) return; // 必须是房间成员

      const baseDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(chainId), 'steps', String(stepIndex));
      ensureDir(baseDir);
      const evPath = path.join(baseDir, 'events.jsonl');
      const now = Date.now();
      const withMeta = events.map(e => ({ ...e, t: now, from: socket.id }));
      appendJsonl(evPath, withMeta);
    } catch (err) {
      console.error('telephone/draw-events error:', err);
    }
  });

  // Telephone 模式：阶段变化广播（由房主/服务端触发）
  socket.on('telephone/phase-change', (payload) => {
    try {
      const { roomId, phase, deadline, assigneeId, chainId, stepIndex, playersOrder, multiChain } = payload || {};
      if (!roomId || !phase) return;
      if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) return;
      
      // 初始化房间的传话链状态
      if (!rooms[roomId].telephoneState) {
        rooms[roomId].telephoneState = {
          phase: 'idle',
          stepIndex: 0,
          deadline: null,
          playersOrder: [],
          chains: {}, // 多条链状态 { chainId: { assigneeId, ... } }
          multiChain: false
        };
      }
      
      // 更新房间传话链状态
      const state = rooms[roomId].telephoneState;
      state.phase = phase;
      state.deadline = deadline || null;
      if (typeof stepIndex !== 'undefined') state.stepIndex = stepIndex;
      if (Array.isArray(playersOrder)) state.playersOrder = playersOrder;
      if (typeof multiChain !== 'undefined') state.multiChain = multiChain;
      
      // 处理多链模式的链分配
      if (multiChain && phase !== 'idle' && Array.isArray(playersOrder) && playersOrder.length > 0) {
        // 为每个玩家创建一条链，并分配当前阶段的执行者
        playersOrder.forEach((playerId, index) => {
          const chainId = `chain_${playerId}`;
          if (!state.chains[chainId]) {
            state.chains[chainId] = {
              ownerId: playerId,
              assigneeId: null
            };
          }
          
          // 计算当前阶段的执行者（环形传递）
          const currentStepIndex = stepIndex || 0;
          const assigneeIndex = (index + currentStepIndex) % playersOrder.length;
          state.chains[chainId].assigneeId = playersOrder[assigneeIndex];
        });
      } else if (!multiChain) {
        // 单链模式保持原有逻辑
        if (typeof assigneeId !== 'undefined') {
          const singleChainId = chainId || 'default';
          if (!state.chains[singleChainId]) {
            state.chains[singleChainId] = {};
          }
          state.chains[singleChainId].assigneeId = assigneeId;
        }
      }
      
      // 广播阶段变化
      const out = { 
        phase, 
        deadline: deadline || null, 
        stepIndex: stepIndex || 0,
        at: Date.now(),
        multiChain: multiChain || false
      };
      
      if (Array.isArray(playersOrder)) out.playersOrder = playersOrder;
      
      // 在多链模式下，发送所有链的分配信息
      if (multiChain && state.chains) {
        out.chainAssignments = state.chains;
      } else if (!multiChain && typeof assigneeId !== 'undefined') {
        // 单链模式保持原有字段
        out.assigneeId = assigneeId;
        if (typeof chainId !== 'undefined') out.chainId = chainId;
      }
      
      io.to(roomId).emit('telephone/phase', out);
    } catch (err) {
      console.error('telephone/phase-change error:', err);
    }
  });

  // Telephone 模式：提交（画作或描述）
  socket.on('telephone/submit', (payload, ack) => {
    try {
      const { roomId, chainId, stepIndex, type, data } = payload || {};
      console.log(`[提交画作] 收到请求:`, { roomId, chainId, stepIndex, type, socketId: socket.id });
      
      if (!roomId || !chainId || typeof stepIndex === 'undefined') {
        console.log(`[提交画作] 参数不完整:`, { roomId, chainId, stepIndex });
        return;
      }
      if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) {
        console.log(`[提交画作] 房间或客户端不存在`);
        return;
      }

      // 获取房间传话链状态
      const state = rooms[roomId].telephoneState;
      if (!state) {
        console.log(`[提交画作] 房间传话链状态不存在`);
        return;
      }
      
      // 确定链ID（多链模式下以当前指派的链为准）
      let targetChainId = chainId;
      if (state.multiChain) {
        const assignedEntry = Object.entries(state.chains || {}).find(([cid, ch]) => ch && ch.assigneeId === socket.id);
        if (assignedEntry) {
          targetChainId = assignedEntry[0];
        } else {
          // 兜底：如果没有找到，使用客户端传来的链或基于用户ID的链
          targetChainId = chainId || `chain_${socket.id}`;
        }
        console.log(`[提交画作] 使用指派链处理提交:`, { targetChainId, userId: socket.id });
      }

      const baseDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(targetChainId), 'steps', String(stepIndex));
      ensureDir(baseDir);
      const submitPath = path.join(baseDir, type === 'desc' ? 'desc.json' : 'submit.json');
      const content = {
        type: type || 'draw',
        data: data || null,
        from: socket.id,
        username: rooms[roomId].clients[socket.id]?.username,
        at: Date.now()
      };
      
      console.log(`[提交画作] 保存文件:`, { submitPath, contentType: content.type });
      fs.writeFile(submitPath, JSON.stringify(content, null, 2), (err) => { 
        if (err) {
          console.error('write submit error:', err);
        } else {
          console.log(`[提交画作] 文件保存成功:`, submitPath);
        }
      });

      // 广播提交事件
      const broadcastData = {
        chainId: targetChainId,
        stepIndex,
        type: content.type,
        from: content.from,
        multiChain: state.multiChain || false
      };
      
      // 在多链模式下，添加提交统计信息
      if (state.multiChain) {
        // 统计当前阶段的提交情况
        if (!state.submissions) state.submissions = {};
        const submissionKey = `step${stepIndex}_${type}`;
        if (!state.submissions[submissionKey]) state.submissions[submissionKey] = new Set();
        const userId = socket.id; // 使用socket.id作为userId
        state.submissions[submissionKey].add(userId);
        
        broadcastData.submissionCount = state.submissions[submissionKey].size;
        broadcastData.totalPlayers = state.playersOrder.length;
        broadcastData.allSubmitted = state.submissions[submissionKey].size >= state.playersOrder.length;
        
        console.log(`[提交画作] 多链模式统计:`, {
          submissionKey,
          submissionCount: broadcastData.submissionCount,
          totalPlayers: broadcastData.totalPlayers,
          allSubmitted: broadcastData.allSubmitted
        });
      }
      
      console.log(`[提交画作] 广播提交事件:`, broadcastData);
      io.to(roomId).emit('telephone/submit-broadcast', broadcastData);
      
      // 在多链模式下，如果所有玩家都提交完成，自动切换到下一阶段
      if (state.multiChain && broadcastData.allSubmitted) {
        console.log(`[提交画作] 所有玩家提交完成，准备自动切换阶段`);
        setTimeout(() => {
          const currentPhase = state.phase;
          const currentStepIndex = state.stepIndex || 0;
          
          if (currentPhase === 'drawing') {
            // 从绘画阶段切换到描述阶段
            state.phase = 'describing';
            state.stepIndex = currentStepIndex; // 保持同一步骤
            state.deadline = new Date(Date.now() + 60 * 1000); // 60秒描述时间
            
            // 重新分配执行者：描述阶段，每个人描述上一个人的画
            // 例如：A的链轮到B描述，B的链轮到C描述，C的链轮到D描述，D的链轮到A描述
            state.playersOrder.forEach((playerId, index) => {
              const chainId = `chain_${playerId}`;
              if (state.chains[chainId]) {
                // 计算谁来描述这个链：下一个玩家
                const nextIndex = (index + 1) % state.playersOrder.length;
                const assigneeId = state.playersOrder[nextIndex];
                state.chains[chainId].assigneeId = assigneeId;
              }
            });
            
            console.log(`[自动切换] 从绘画阶段切换到描述阶段，房间 ${roomId}`);
          } else if (currentPhase === 'describing') {
            // 从描述阶段切换到下一轮绘画阶段或进入展示阶段
            // 规则：总回合数 = floor(N / 2)，每回合包含绘画 + 描述，并保证以描述结尾
            const nextStepIndex = currentStepIndex + 1;
            const totalPlayers = Array.isArray(state.playersOrder) ? state.playersOrder.length : 0;
            const maxRounds = Math.floor(Math.max(0, totalPlayers) / 2);

            if (nextStepIndex < maxRounds) {
              // 继续下一轮绘画
              state.phase = 'drawing';
              state.stepIndex = nextStepIndex;
              state.deadline = new Date(Date.now() + 60 * 1000); // 60秒绘画时间
              
              // 重新分配执行者：绘画阶段，环形传递
              state.playersOrder.forEach((playerId, index) => {
                const targetIndex = (index + nextStepIndex) % state.playersOrder.length;
                const targetPlayerId = state.playersOrder[targetIndex];
                const chainId = `chain_${targetPlayerId}`;
                if (state.chains[chainId]) {
                  state.chains[chainId].assigneeId = playerId;
                }
              });
              
              console.log(`[自动切换] 从描述阶段切换到第${nextStepIndex}轮绘画阶段，房间 ${roomId}`);
            } else {
              // 进入展示阶段（Result）
              state.phase = 'result';
              state.deadline = null;
              console.log(`[自动切换] 进入展示阶段（Result），房间 ${roomId}`);
            }
          }
          
          // 清除当前阶段的提交统计
          if (state.submissions) {
            const submissionKey = `step${currentStepIndex}_${type}`;
            delete state.submissions[submissionKey];
          }
          
          // 广播阶段变化
          io.to(roomId).emit('telephone/phase', {
            phase: state.phase,
            deadline: state.deadline,
            stepIndex: state.stepIndex,
            playersOrder: state.playersOrder,
            multiChain: state.multiChain,
            chainAssignments: state.chains
          });
        }, 1000); // 延迟1秒切换，让客户端有时间处理提交广播
      }
      
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('telephone/submit error:', err);
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  // Telephone 模式：题目选择
  socket.on('telephone/select-topic', (payload, ack) => {
    try {
      const { roomId, chainId, topic } = payload || {};
      console.log(`[题目选择] 收到请求:`, { roomId, chainId, topic, socketId: socket.id });
      console.log(`[题目选择] 房间状态:`, { 
        roomExists: !!rooms[roomId], 
        clientExists: !!rooms[roomId]?.clients[socket.id],
        userId: rooms[roomId]?.clients[socket.id]?.userId 
      });
      
      if (!roomId || !topic) {
        console.log(`[题目选择] 参数不完整:`, { roomId, topic });
        return;
      }
      if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) {
        console.log(`[题目选择] 房间或客户端不存在`);
        return;
      }
      
      const state = rooms[roomId].telephoneState;
      if (!state || state.phase !== 'topic-selection') {
        console.log(`[题目选择] 游戏状态错误:`, { state: state?.phase });
        return;
      }
      
      // 使用socket.id作为userId（多链模式中userId就是socket.id）
      const userId = socket.id;
      if (!userId) {
        console.log(`[题目选择] userId不存在`);
        return;
      }
      
      console.log(`[题目选择] 使用userId: ${userId}`);
      
      if (state.multiChain) {
        // 多链模式：保存到对应的链
        const targetChainId = chainId || `chain_${userId}`;
        if (state.chains[targetChainId] && state.chains[targetChainId].ownerId === userId) {
          // 保存题目到文件系统
          const baseDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', String(targetChainId), 'steps', '0');
          ensureDir(baseDir);
          const answerPath = path.join(baseDir, 'answer.json');
          const answerData = {
            answer: topic,
            from: socket.id,
            username: rooms[roomId].clients[socket.id]?.username,
            at: Date.now()
          };
          fs.writeFile(answerPath, JSON.stringify(answerData, null, 2), (err) => { 
            if (err) console.error('write answer error:', err); 
          });
          
          // 统计选择完成的玩家数量
          if (!state.topicSelections) state.topicSelections = new Set();
          state.topicSelections.add(userId);
          
          console.log(`[多链模式] 玩家 ${userId} 选择了题目，当前已选择: ${state.topicSelections.size}/${state.playersOrder.length}`);
          
          // 检查是否所有玩家都选择完毕
          if (state.topicSelections.size >= state.playersOrder.length) {
            console.log(`[多链模式] 所有玩家都选择完毕，准备切换到绘画阶段`);
            // 所有玩家都选择完毕，切换到绘画阶段
            setTimeout(() => {
              state.phase = 'drawing';
              state.stepIndex = 0;
              state.deadline = new Date(Date.now() + 60 * 1000); // 60秒绘画时间
              
              // 重新分配执行者
              state.playersOrder.forEach((playerId, index) => {
                const chainId = `chain_${playerId}`;
                if (state.chains[chainId]) {
                  // 环形传递：第0步，每个人处理自己的链
                  state.chains[chainId].assigneeId = playerId;
                }
              });
              
              console.log(`[多链模式] 广播阶段切换到绘画阶段，房间 ${roomId}`);
              
              // 广播阶段变化
              io.to(roomId).emit('telephone/phase', {
                phase: state.phase,
                deadline: state.deadline,
                stepIndex: state.stepIndex,
                playersOrder: state.playersOrder,
                multiChain: state.multiChain,
                chainAssignments: state.chains
              });
            }, 100);
          }
        }
      } else {
        // 单链模式：保存到传话链
        const baseDir = path.join(__dirname, '..', 'uploads', 'rooms', String(roomId), 'chains', 'main', 'steps', '0');
        ensureDir(baseDir);
        const answerPath = path.join(baseDir, 'answer.json');
        const answerData = {
          answer: topic,
          from: socket.id,
          username: rooms[roomId].clients[socket.id]?.username,
          at: Date.now()
        };
        fs.writeFile(answerPath, JSON.stringify(answerData, null, 2), (err) => { 
          if (err) console.error('write answer error:', err); 
        });
      }
      
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error('telephone/select-topic error:', err);
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  // Telephone 模式：投票（是否符合题目）
  socket.on('telephone/vote', (payload) => {
    try {
      const { roomId, chainId, pass } = payload || {};
      if (!roomId || !chainId) return;
      if (!rooms[roomId] || !rooms[roomId].clients[socket.id]) return;
      const state = rooms[roomId].telephoneState;
      if (!state) return;

      if (!state.votes) state.votes = {};
      if (!state.votes[chainId]) state.votes[chainId] = {};
      state.votes[chainId][socket.id] = !!pass;

      const votesMap = state.votes[chainId];
      const yesCount = Object.values(votesMap).filter(v => v === true).length;
      const noCount = Object.values(votesMap).filter(v => v === false).length;

      io.to(roomId).emit('telephone/vote-broadcast', {
        roomId,
        chainId,
        voterId: socket.id,
        pass: !!pass,
        yesCount,
        noCount,
        totalPlayers: (state.playersOrder || []).length,
        votes: votesMap
      });
    } catch (err) {
      console.error('telephone/vote error:', err);
    }
  });

  // 7. 房主踢出成员
  socket.on('kick-member', (payload) => {
    const { roomId, target } = payload || {};
    if (!roomId || !rooms[roomId]) return;

    // 权限检查：只有房主可以踢人
    if (rooms[roomId].owner !== socket.id) {
      socket.emit('kick-error', { roomId, message: '只有房主可以踢人' });
      return;
    }

    // 不允许踢出房主自己
    if (target === rooms[roomId].owner) {
      socket.emit('kick-error', { roomId, message: '不能踢出房主' });
      return;
    }

    // 查找目标成员（按ID）
    const targetSocketId = target;
    const clientInfo = rooms[roomId].clients[targetSocketId];
    if (!clientInfo) {
      socket.emit('kick-error', { roomId, message: '目标成员不存在' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) {
      socket.emit('kick-error', { roomId, message: '目标成员不在线' });
      return;
    }

    // 执行移除
    targetSocket.leave(roomId);
    delete rooms[roomId].clients[targetSocketId];

    // 通知被踢用户
    io.to(targetSocketId).emit('kicked', { roomId, reason: '被房主移出房间' });

    // 广播系统消息与成员列表更新
    broadcastSystemMessage(roomId, `${clientInfo.username} 被房主移出房间`);
    // 同步语音成员列表
    rooms[roomId]?.voiceMembers?.delete(targetSocketId);
    broadcastRoomMembers(roomId);
    broadcastVoiceMembers(roomId);

    // 更新房间列表
    if (Object.keys(rooms[roomId].clients).length === 0) {
      delete rooms[roomId];
    }
    broadcastRoomList();
  });

  // 5.x 语音频道加入/退出与信令
  socket.on('voice-join', (payload = {}) => {
    const { roomId } = payload;
    if (!roomId || !rooms[roomId] || !rooms[roomId].clients[socket.id]) return;
    rooms[roomId].voiceMembers.add(socket.id);
    broadcastVoiceMembers(roomId);
  });

  socket.on('voice-leave', (payload = {}) => {
    const { roomId } = payload;
    if (!roomId || !rooms[roomId]) return;
    rooms[roomId].voiceMembers.delete(socket.id);
    broadcastVoiceMembers(roomId);
  });

  // WebRTC 信令转发（只做中继，不处理媒体数据）
  socket.on('rtc-offer', (payload = {}) => {
    const { roomId, toId, sdp } = payload;
    if (!roomId || !toId || !rooms[roomId]) return;
    io.to(toId).emit('rtc-offer', { roomId, fromId: socket.id, sdp });
  });

  socket.on('rtc-answer', (payload = {}) => {
    const { roomId, toId, sdp } = payload;
    if (!roomId || !toId || !rooms[roomId]) return;
    io.to(toId).emit('rtc-answer', { roomId, fromId: socket.id, sdp });
  });

  socket.on('rtc-candidate', (payload = {}) => {
    const { roomId, toId, candidate } = payload;
    if (!roomId || !toId || !rooms[roomId]) return;
    io.to(toId).emit('rtc-candidate', { roomId, fromId: socket.id, candidate });
  });

  // 6. 断开连接处理
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);

    // 遍历所有房间，移除该socket
    Object.keys(rooms).forEach(roomId => {
      if (rooms[roomId].clients[socket.id]) {
        const leavingUsername = rooms[roomId].clients[socket.id].username;
        // 从房间中移除用户
        delete rooms[roomId].clients[socket.id];

        // 如果断开的是房主，进行房主转移
        if (rooms[roomId].owner === socket.id) {
          const remainingIds = Object.keys(rooms[roomId].clients);
          rooms[roomId].owner = remainingIds[0] || null;
          if (rooms[roomId].owner) {
            const newOwnerName = rooms[roomId].clients[rooms[roomId].owner]?.username || '未知';
            broadcastSystemMessage(roomId, `房主变更为 ${newOwnerName}`);
          }
        }

        // 广播系统消息
        broadcastSystemMessage(roomId, `${socket.data.username} 断开了连接`);

        // 同步语音成员列表
        rooms[roomId]?.voiceMembers?.delete(socket.id);

        // 广播房间成员更新
        broadcastRoomMembers(roomId);
        broadcastVoiceMembers(roomId);

        // 如果房间为空，删除房间
        if (Object.keys(rooms[roomId].clients).length === 0) {
          delete rooms[roomId];
          console.log(`删除空房间: ${roomId}`);
        }
      }
    });

    // 广播房间列表更新
    broadcastRoomList();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`Socket.IO 服务已启动`);
});

module.exports = app;

// 简易定时清理：保留7天（可通过环境变量 TELEPHONE_RETENTION_DAYS 调整）
const RETENTION_DAYS = parseInt(process.env.TELEPHONE_RETENTION_DAYS || '7', 10);
const RETENTION_MS = Math.max(1, RETENTION_DAYS) * 24 * 60 * 60 * 1000;

function cleanupUploads() {
  const root = path.join(__dirname, '..', 'uploads');
  const now = Date.now();
  try {
    const walk = (dir) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        try {
          const stat = fs.statSync(full);
          if (ent.isDirectory()) {
            walk(full);
            // 若目录为空且过期，删除
            const children = fs.readdirSync(full);
            if (children.length === 0 && (now - stat.mtimeMs) > RETENTION_MS) {
              try { fs.rmSync(full, { recursive: true, force: true }); } catch (_) {}
            }
          } else {
            if ((now - stat.mtimeMs) > RETENTION_MS) {
              try { fs.rmSync(full, { force: true }); } catch (_) {}
            }
          }
        } catch (_) {}
      }
    };
    walk(root);
  } catch (err) {
    console.error('cleanupUploads error:', err);
  }
}

// 每6小时清理一次
setInterval(cleanupUploads, 6 * 60 * 60 * 1000);

// Socket.IO 连接处理