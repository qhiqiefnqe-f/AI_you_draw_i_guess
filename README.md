# You Draw I Guess

一个基于 Vue3 + Node.js + Socket.IO 的多人在线画图猜词游戏。

## 项目结构

这是一个 monorepo 项目，包含前端和后端两个子项目：

```
you_draw_i_guess/
├── udig_fe/                 # 前端项目 (Vue3 + Vite)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── udig_be/                 # 后端项目 (Node.js + Express + Socket.IO)
│   ├── src/
│   │   ├── app.js          # 主应用文件
│   │   ├── routes/         # 路由文件
│   │   └── controllers/    # 控制器文件
│   ├── package.json
│   └── ...
├── package.json             # 根目录 package.json (工作区配置)
├── .npmrc                   # npm 配置
├── .gitignore
├── .editorconfig
└── README.md
```

## 技术栈

### 前端 (udig_fe)
- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 快速的前端构建工具
- **TypeScript** - 类型安全的 JavaScript

### 后端 (udig_be)
- **Node.js** - JavaScript 运行时
- **Express** - Web 应用框架
- **Socket.IO** - 实时双向通信库
- **CORS** - 跨域资源共享中间件

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- pnpm >= 7.0.0

### 安装依赖

```bash
# 安装所有依赖（根目录 + 前端 + 后端）
pnpm install

# 或者使用简化命令
pnpm run install:all
```

### 开发模式

```bash
# 同时启动前端和后端开发服务器
pnpm run dev

# 或者分别启动
pnpm run dev:fe  # 启动前端开发服务器 (http://localhost:5173)
pnpm run dev:be  # 启动后端开发服务器 (http://localhost:3000)
```

### 生产构建

```bash
# 构建前端项目
pnpm run build

# 启动后端生产服务器
pnpm run start
```

## 可用脚本

### 根目录脚本
- `pnpm run dev` - 同时启动前后端开发服务器
- `pnpm run dev:fe` - 启动前端开发服务器
- `pnpm run dev:be` - 启动后端开发服务器
- `pnpm run build` - 构建前端项目
- `pnpm run start` - 启动后端生产服务器
- `pnpm install` - 安装所有依赖
- `pnpm run clean` - 清理所有子项目
- `pnpm run lint` - 运行所有子项目的代码检查
- `pnpm run test` - 运行所有子项目的测试

### 前端脚本 (udig_fe)
- `pnpm run dev` - 启动开发服务器
- `pnpm run build` - 构建生产版本
- `pnpm run preview` - 预览构建结果

### 后端脚本 (udig_be)
- `pnpm run start` - 启动生产服务器
- `pnpm run dev` - 启动开发服务器（使用 nodemon）
- `pnpm run test` - 运行测试
- `pnpm run lint` - 代码检查

## 游戏功能

- 🎨 **实时绘画** - 多人实时协作绘画
- 💬 **聊天系统** - 游戏内聊天功能
- 🏠 **房间系统** - 创建和加入游戏房间
- 👥 **多人游戏** - 支持多人同时游戏
- 🎯 **猜词游戏** - 画图猜词玩法

## API 接口

### REST API
- `GET /` - 服务器状态
- `GET /health` - 健康检查
- `GET /rooms` - 获取房间列表
- `POST /rooms` - 创建新房间
- `GET /rooms/:roomId` - 获取房间信息

### Socket.IO 事件
- `join-room` - 加入房间
- `leave-room` - 离开房间
- `drawing-data` - 绘画数据传输
- `chat-message` - 聊天消息
- `user-joined` - 用户加入通知
- `user-left` - 用户离开通知

## 开发指南

### 环境变量配置

后端项目支持环境变量配置，复制 `udig_be/.env.example` 到 `udig_be/.env` 并根据需要修改：

```bash
cd udig_be
cp .env.example .env
```

### 代码规范

项目使用 ESLint 进行代码检查，使用 EditorConfig 统一代码格式。

```bash
# 运行代码检查
pnpm run lint

# 自动修复代码格式问题
pnpm run lint:fix
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。