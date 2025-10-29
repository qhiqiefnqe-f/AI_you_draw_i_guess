# You Draw I Guess - 后端服务

基于 Node.js + Express + Socket.IO 的实时多人游戏后端服务。

## 技术栈

- **Node.js** - 运行时环境
- **Express** - Web 框架
- **Socket.IO** - 实时双向通信
- **CORS** - 跨域资源共享

## 快速开始

### 安装依赖
```bash
pnpm install
```

### 启动开发服务器
```bash
pnpm run dev
```

服务器将在 `http://localhost:3001` 启动

### 环境配置

复制 `.env.example` 到 `.env` 并配置：

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

## Socket.IO 事件接口

### 客户端事件（发送到服务器）

#### 1. 用户身份识别
```javascript
socket.emit('identify', { username: 'player1' });
```
- **必须首先调用**：连接后必须先发送此事件
- **作用**：设置用户名到 `socket.data.username`
- **默认**：未识别用户显示为"匿名用户"

#### 2. 加入房间
```javascript
socket.emit('join-room', { roomId: 'room123' });
```
- **作用**：加入指定房间（不存在则自动创建）
- **触发**：系统消息、成员更新、房间列表更新

#### 3. 发送聊天消息
```javascript
socket.emit('chat-message', { roomId: 'room123', text: '你好！' });
```
- **限制**：消息最大1000字符，自动HTML转义
- **广播**：发送到房间内所有成员

#### 4. 离开房间
```javascript
socket.emit('leave-room', { roomId: 'room123' });
```
- **作用**：主动离开房间
- **清理**：空房间自动删除

#### 5. 获取房间列表
```javascript
socket.emit('get-room-list', null, (roomList) => {
  console.log(roomList); // [{ id, name, count }]
});
```
- **回调**：返回当前所有房间信息

### 服务器事件（发送到客户端）

#### 1. 系统消息
```javascript
socket.on('system-message', (data) => {
  // data: { roomId, text, time }
});
```
- **触发时机**：用户加入/离开房间

#### 2. 聊天消息
```javascript
socket.on('chat-message', (message) => {
  // message: { from, text, time, type: 'chat' }
});
```
- **接收**：房间内其他用户的聊天消息

#### 3. 房间成员更新
```javascript
socket.on('room-members', (data) => {
  // data: { roomId, members: ['user1', 'user2'] }
});
```
- **触发时机**：有用户加入/离开房间

#### 4. 房间列表更新
```javascript
socket.on('room-list', (rooms) => {
  // rooms: [{ id: 'room123', name: 'room123', count: 2 }]
});
```
- **触发时机**：房间创建/删除时广播给所有客户端

## 数据结构

### 内存存储 - rooms 对象
```javascript
const rooms = {
  'room123': {
    name: 'room123',           // 房间名称（当前使用roomId）
    createdAt: 1640995200000,  // 创建时间戳
    clients: {
      'socketId1': {
        username: 'player1',   // 用户名
        joinedAt: 1640995200000 // 加入时间戳
      },
      'socketId2': {
        username: 'player2',
        joinedAt: 1640995210000
      }
    }
  }
};
```

## 使用示例

### 前端连接示例
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// 1. 首先识别身份
socket.emit('identify', { username: 'MyUsername' });

// 2. 加入房间
socket.emit('join-room', { roomId: 'game-room-1' });

// 3. 监听消息
socket.on('chat-message', (message) => {
  console.log(`${message.from}: ${message.text}`);
});

socket.on('system-message', (data) => {
  console.log(`系统消息: ${data.text}`);
});

socket.on('room-members', (data) => {
  console.log(`房间 ${data.roomId} 成员:`, data.members);
});

// 4. 发送消息
socket.emit('chat-message', { 
  roomId: 'game-room-1', 
  text: '大家好！' 
});

// 5. 获取房间列表
socket.emit('get-room-list', null, (rooms) => {
  console.log('当前房间:', rooms);
});
```

## 安全特性

- **HTML转义**：自动转义聊天消息中的HTML字符
- **消息长度限制**：聊天消息最大1000字符
- **CORS配置**：仅允许指定域名访问

## 开发说明

- **热重载**：使用 nodemon 自动重启
- **代码规范**：ESLint 配置
- **测试**：Jest 测试框架（待配置）

## 项目结构

```
udig_be/
├── src/
│   ├── app.js              # 主应用文件（Socket.IO服务器）
│   ├── routes/
│   │   └── index.js        # Express路由
│   └── controllers/
│       └── gameController.js # 游戏控制器
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 后续扩展

- [ ] 数据库持久化（Redis/MongoDB）
- [ ] 用户认证（JWT）
- [ ] 游戏状态管理
- [ ] 绘画数据传输
- [ ] 房间密码保护
- [ ] 管理员功能