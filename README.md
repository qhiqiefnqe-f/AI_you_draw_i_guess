# You Draw I Guess · 你画我猜

一个基于 Vue 3 + TypeScript + Socket.IO 的多人实时房间与聊天的你画我猜应用，此项目亮点为搭配ai workflow实现ai玩家（包括识图，聊天，评价等功能）（开发中...）。本仓库为 monorepo，包含前端与后端两部分，但 README 重点突出前端，后端给出框架概览。
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
## 前端亮点

### 实时通信（Socket.IO + Pinia）
- 连接与握手：首次连接后发送 `identify` 完成身份识别；统一在 Pinia actions 中管理连接、订阅、解绑与错误处理。
- Ack 语义与一致性：加入/离开房间使用回调确认（Ack），确保本地状态只在成功后更新，避免“幽灵成员”。
- 断线重连与恢复：自动检测断线并重连；重连后按上次上下文恢复房间与订阅，展示连接状态指示与重试提示。
- 事件分层：消息、系统提示、成员列表/房间列表分别通过独立事件流维护，降低耦合，便于扩展玩法（画布/语音）。
- 性能与背压：对高频事件做节流/合并（如成员心跳、消息已读回执），避免 UI 抖动与网络拥塞。

### 语音房（WebRTC，可选/可扩展）
- 连接模型：WebRTC P2P 为基础，支持引入 STUN/TURN；根据房间规模可切换 SFU（如 `peer -> SFU`）以提升并发与稳定性。
- 音频处理：启用回声消除（AEC）、噪声抑制（NS）、自动增益（AGC）；音量可视化（VU meter）与发言检测（Voice Activity Detection）。
- 设备与权限：麦克风设备选择、静音/取消静音、输入增益调节。
- 网络自适应：码率/采样率随网络质量自动调整；断线自动重连与轨道重协商（renegotiation）。

注：语音房为可选模块，README 提供设计与集成方案，代码实现可逐步引入（WebRTC 客户端与信令对接）。

### 画布实现（Canvas）
- 绘制管线：基于 HTML5 Canvas，按 `pointerdown/move/up` 收集点序列；使用 `requestAnimationFrame` 批量渲染，降低抖动。
- 工具与图层：画笔、橡皮、吸管、形状；多人图层（按用户区分），远端笔画按增量合并，避免覆盖冲突。
- 同步协议：仅发送增量笔画（起点+点列），支持压缩/节流；带 Ack 与重传，弱网下保证顺序与完整性。
- 历史与导出：本地历史（Undo/Redo）、快照；导出 PNG/SVG；可扩展服务端持久化与回放。

## 核心功能
- 房间系统：创建/加入/离开房间，房间列表浏览与人数统计。
- 实时聊天：文本消息、系统消息分流显示；错误与重试反馈。
- 成员管理：在线成员、角色（房主/普通成员）、连接与发言状态指示。
- 语音房（可选）：一键开麦/禁麦、设备选择、音量指示与发言检测、房主控权。
- 实时画布：多人同步绘制、平滑笔触、图层隔离、历史回放与导出。
- 词库配置：系统/自定义词库管理，房间配置对话框中动态加载与选择（与玩法联动）。
- 断线重连：自动恢复订阅与房间上下文，保持体验连续性。
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