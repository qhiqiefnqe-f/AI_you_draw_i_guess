# 你画我猜 - 前端项目

基于 Vue 3 + TypeScript + Socket.IO 的实时多人聊天室前端应用。

## 🚀 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **语言**: TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router
- **样式**: UnoCSS + 自定义CSS
- **实时通信**: Socket.IO Client
- **包管理**: pnpm

## 📁 项目结构

```
udig_fe/
├── public/                 # 静态资源
├── src/
│   ├── components/         # 可复用组件
│   │   ├── ChatWindow.vue     # 聊天窗口组件
│   │   ├── MessageItem.vue    # 消息项组件
│   │   ├── MembersList.vue    # 成员列表组件
│   │   └── JoinForm.vue       # 登录表单组件
│   ├── pages/              # 页面组件
│   │   ├── Lobby.vue          # 大厅页面
│   │   └── Room.vue           # 房间页面
│   ├── store/              # 状态管理
│   │   └── index.js           # Pinia store
│   ├── plugins/            # 插件
│   │   └── socket.js          # Socket.IO 客户端封装
│   ├── styles/             # 样式文件
│   │   └── main.css           # 主样式文件
│   ├── App.vue             # 根组件
│   └── main.ts             # 应用入口
├── package.json            # 项目配置
├── vite.config.ts          # Vite 配置
├── uno.config.ts           # UnoCSS 配置
└── README.md               # 项目文档
```

## 🛠️ 安装与运行

### 环境要求

- Node.js >= 16
- pnpm >= 8

### 安装依赖

```bash
# 在项目根目录
pnpm install

# 或者在前端目录
cd udig_fe
pnpm install
```

### 开发模式

```bash
# 在项目根目录启动前端
pnpm run dev:fe

# 或者在前端目录
cd udig_fe
pnpm run dev
```

### 构建生产版本

```bash
# 在项目根目录
pnpm run build:fe

# 或者在前端目录
cd udig_fe
pnpm run build
```

### 预览生产版本

```bash
cd udig_fe
pnpm run preview
```

## 🎯 功能特性

### 核心功能

- **用户身份验证**: 输入用户名进入应用
- **房间管理**: 创建房间、加入房间、离开房间
- **实时聊天**: 发送和接收消息
- **在线成员**: 查看房间内在线成员
- **房间列表**: 浏览所有可用房间

### 用户体验

- **响应式设计**: 支持桌面端和移动端
- **实时状态**: 连接状态指示器
- **错误处理**: 友好的错误提示
- **加载状态**: 操作过程中的加载指示
- **断线重连**: 自动重连机制

## 🔌 Socket.IO 事件

### 客户端发送事件

```javascript
// 用户身份验证
socket.emit('identify', { username })

// 加入房间
socket.emit('join-room', { roomId }, callback)

// 离开房间
socket.emit('leave-room', { roomId }, callback)

// 发送消息
socket.emit('chat-message', { roomId, text }, callback)

// 获取房间列表
socket.emit('get-room-list', callback)
```

### 客户端监听事件

```javascript
// 接收聊天消息
socket.on('chat-message', ({ from, text, time, type }) => {})

// 接收系统消息
socket.on('system-message', ({ roomId, text, time }) => {})

// 房间成员更新
socket.on('room-members', ({ roomId, members }) => {})

// 房间列表更新
socket.on('room-list', (rooms) => {})
```

## 📊 状态管理

使用 Pinia 管理应用状态：

```javascript
// 主要状态
{
  username: string,           // 用户名
  socketConnected: boolean,   // Socket连接状态
  rooms: Array,              // 房间列表
  currentRoom: string,       // 当前房间ID
  members: Array,            // 当前房间成员
  messages: Array,           // 聊天消息
  loading: boolean,          // 加载状态
  error: string             // 错误信息
}
```

## 🎨 样式系统

### UnoCSS 配置

项目使用 UnoCSS 作为主要的 CSS 框架，配置了：

- **预设**: `@unocss/preset-uno`, `@unocss/preset-attributify`
- **自定义规则**: 按钮、卡片等组件样式
- **快捷方式**: 常用的布局组合
- **主题**: 自定义颜色调色板

### 自定义样式

在 `src/styles/main.css` 中定义了：

- 全局重置样式
- 组件样式类
- 工具类
- 响应式样式
- 动画效果

## 🔧 开发指南

### 添加新组件

1. 在 `src/components/` 目录创建 `.vue` 文件
2. 使用 Composition API 编写组件逻辑
3. 使用 UnoCSS 类名进行样式设计
4. 在需要的地方导入并使用

### 添加新页面

1. 在 `src/pages/` 目录创建 `.vue` 文件
2. 在 `src/main.ts` 中添加路由配置
3. 实现页面逻辑和样式

### 状态管理

使用 Pinia store 进行状态管理：

```javascript
import { useStore } from '@/store'

const store = useStore()

// 调用 actions
store.connect(username)
store.joinRoom(roomId)
store.sendMessage(text)
```

### Socket.IO 使用

通过 store 中的方法使用 Socket.IO：

```javascript
// 连接
await store.connect(username)

// 发送事件
await store.sendMessage(text)

// 监听事件（在 store 中自动处理）
```

## 🐛 调试

### 开发工具

在开发模式下，以下工具被暴露到全局：

```javascript
window.__APP__     // Vue 应用实例
window.__ROUTER__  // Vue Router 实例
window.__PINIA__   // Pinia 实例
```

### 日志

应用会在控制台输出关键操作的日志：

- Socket 连接状态
- 路由变化
- 错误信息
- 用户操作

## 📱 响应式设计

### 断点

- **移动端**: < 640px
- **平板端**: 640px - 1024px
- **桌面端**: > 1024px

### 适配策略

- 移动端：成员列表折叠为抽屉
- 平板端：适中的间距和字体
- 桌面端：完整的侧边栏布局

## 🔒 安全考虑

- **输入验证**: 用户名和消息长度限制
- **XSS 防护**: 消息内容 HTML 转义
- **错误处理**: 不暴露敏感信息
- **连接安全**: Socket.IO 自动重连

## 🚀 部署

### 构建

```bash
pnpm run build
```

### 部署到静态服务器

构建后的文件在 `dist/` 目录，可以部署到任何静态文件服务器。

### 环境变量

可以通过环境变量配置：

```bash
# 后端服务器地址
VITE_SERVER_URL=http://localhost:3001
```

## 🤝 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License

## 🔗 相关链接

- [Vue 3 文档](https://vuejs.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [UnoCSS 文档](https://unocss.dev/)
- [Socket.IO 文档](https://socket.io/)
- [Vite 文档](https://vitejs.dev/)

---

**注意**: 确保后端服务已启动并运行在正确的端口上（默认 3001）。
