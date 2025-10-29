class GameController {
  constructor() {
    this.rooms = new Map();
    this.players = new Map();
  }

  // 创建房间
  createRoom(roomData) {
    const roomId = Date.now().toString();
    const room = {
      id: roomId,
      name: roomData.name || `房间 ${roomId}`,
      maxPlayers: roomData.maxPlayers || 6,
      players: [],
      currentDrawer: null,
      currentWord: null,
      gameStatus: 'waiting', // waiting, playing, finished
      round: 0,
      maxRounds: 3,
      scores: new Map(),
      createdAt: new Date()
    };
    
    this.rooms.set(roomId, room);
    return room;
  }

  // 加入房间
  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('房间已满');
    }

    const player = {
      id: playerId,
      name: playerName,
      score: 0,
      isDrawer: false,
      joinedAt: new Date()
    };

    room.players.push(player);
    room.scores.set(playerId, 0);
    this.players.set(playerId, { ...player, roomId });

    return room;
  }

  // 离开房间
  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);
    room.scores.delete(playerId);
    this.players.delete(playerId);

    // 如果房间为空，删除房间
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }

    return room;
  }

  // 开始游戏
  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.players.length < 2) {
      throw new Error('至少需要2名玩家才能开始游戏');
    }

    room.gameStatus = 'playing';
    room.round = 1;
    room.currentDrawer = room.players[0].id;
    
    // 设置当前绘画者
    room.players.forEach(player => {
      player.isDrawer = player.id === room.currentDrawer;
    });

    return room;
  }

  // 获取房间信息
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // 获取所有房间
  getAllRooms() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      currentPlayers: room.players.length,
      maxPlayers: room.maxPlayers,
      gameStatus: room.gameStatus
    }));
  }
}

module.exports = new GameController();