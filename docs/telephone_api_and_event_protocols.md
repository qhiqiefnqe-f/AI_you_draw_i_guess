# 绘猜：传话模式（Telephone Mode）——接口与事件协议

本文档以“无数据库（文件 + 内存快照）”为前提，说明后端 HTTP 接口与 Socket.IO 事件，用于上传、检索、房间快照、绘画事件、阶段广播与提交等。

## HTTP 接口

- `GET /health`
  - 返回服务器状态。
  - 响应：`{ status: 'OK', timestamp: string }`

- `POST /api/telephone/upload`（multipart/form-data）
  - 字段：`roomId`, `chainId`, `stepIndex`, `playerId`(可选), `image`(文件：png/webp/jpeg，≤5MB)
  - 行为：优先转为 WebP，失败则回退 PNG；保存至 `uploads/rooms/{roomId}/chains/{chainId}/steps/{stepIndex}/`。
  - 响应：`{ ok: true, url, format:'webp'|'png', width?, height?, uploadedAt, roomId, chainId, stepIndex, playerId? }`

- `GET /api/telephone/chains/:roomId`
  - 列出房间内所有链及概要信息（文件目录扫描）。
  - 响应：`{ ok: true, roomId, chains: [{ chainId, steps, lastUpdated? }] }`

- `GET /api/telephone/chain/:roomId/:chainId`
  - 列出链内各步的概要。
  - 响应：`{ ok: true, roomId, chainId, steps: [{ stepIndex, imageUrl?, meta?, type:'desc'|'draw', hasSubmit, hasEvents }] }`

- `GET /api/telephone/step/:roomId/:chainId/:stepIndex`
  - 返回某一步的完整细节。
  - 响应：`{ ok: true, roomId, chainId, stepIndex, meta?, imageUrl?, desc?, submit?, eventsCount? }`

- `GET /api/telephone/events/:roomId/:chainId/:stepIndex`
  - 返回 `events.jsonl` 内的绘画事件数组。
  - 响应：`{ ok: true, events: object[] }`

- `GET /api/rooms`
  - 房间列表快照。
  - 响应：`{ ok: true, rooms: [{ id, name, count, owner }] }`

- `GET /api/room/:roomId`
  - 房间详情快照。
  - 响应：`{ ok: true, roomId, members: [{ id, name }], owner?, voiceMembers: string[] }`

## Socket.IO 事件

- `identify`
  - 客户端 → 服务端：`{ username }`（服务端转义并截断 ≤50 字）

- `join-room`
  - 客户端 → 服务端：`{ roomId }`
  - 加入房间；若房间不存在则创建；首位加入者为房主。

- `leave-room`
  - 客户端 → 服务端：`{ roomId }`
  - 退出房间；若房主离开则转移房主到下一位成员。

- `chat-message`
  - 客户端 → 服务端：`{ roomId, text }`（text ≤1000 字）
  - 服务端 → 房间：`{ from, fromId, text, time, type:'chat' }`

- `system-message`
  - 服务端 → 房间：`{ roomId, text, time }`（系统通知：加入/离开/房主变更）

- `room-members`
  - 服务端 → 房间：`{ roomId, members:[{ id, name }], owner? }`

- `room-list`
  - 服务端 → 所有：`[{ id, name, count, owner }]`

- `voice-join` / `voice-leave`
  - 客户端 → 服务端：`{ roomId }`
  - 服务端维护 `voiceMembers`，并通过 `voice-members` 广播。

- `voice-members`
  - 服务端 → 房间：`{ roomId, members: string[] }`

- `rtc-offer` / `rtc-answer` / `rtc-candidate`
  - 客户端 → 服务端中继：`{ roomId, toId, sdp|candidate }`
  - 服务端转发给目标 socket。

### 传话模式专用

- `telephone/draw-events`
  - 客户端 → 服务端：`{ roomId, chainId, stepIndex, events: object[] }`
  - 假设客户端已做 33ms 节流；服务端将事件追加到 `events.jsonl` 并自动补充 `{ t, from }` 元数据。

- `telephone/phase-change`
  - 客户端（房主/服务端）→ 服务端：`{ roomId, phase, deadline? }`
  - 服务端 → 房间：`{ phase, deadline?, at }`（MVP 中服务端权威广播）。

- `telephone/submit`
  - 客户端 → 服务端：`{ roomId, chainId, stepIndex, type:'desc'|'draw', data? }`
  - 服务端保存至 `desc.json` 或 `submit.json`，内容含 `{ from, username, at }`，并广播 `telephone/submit-broadcast`。

- `telephone/submit-broadcast`
  - 服务端 → 房间：`{ chainId, stepIndex, type, from }`

## 文件布局

`uploads/rooms/{roomId}/chains/{chainId}/steps/{stepIndex}/`
- `image.webp|image.png` —— 画作图片（优先 WebP）
- `meta.json` —— 图片元数据与请求参数
- `events.jsonl` —— 绘画事件流（JSON Lines）
- `desc.json` —— 文本描述提交
- `submit.json` —— 绘画提交元信息

## 约束与说明

- 保留期：默认 7 天（`TELEPHONE_RETENTION_DAYS`），每 6 小时定时清理。
- 上传上限：5MB；允许 `image/png`, `image/webp`, `image/jpeg`。
- CORS：`CORS_ORIGIN` 环境变量（默认 `*`）。
- MVP 中阶段广播由服务端权威处理；允许缺席玩家。

## 示例

- 上传（PowerShell）：
  - `$Form = @{ roomId='room1'; chainId='abc123'; stepIndex='0'; playerId='p1'; image=Get-Item 'C:\path\to\image.png' }`
  - `Invoke-WebRequest -Uri 'http://localhost:3001/api/telephone/upload' -Method Post -Form $Form`

- 获取事件：
  - `GET http://localhost:3001/api/telephone/events/room1/abc123/0`

- 链概要：
  - `GET http://localhost:3001/api/telephone/chain/room1/abc123`