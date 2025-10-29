const express = require('express');
const router = express.Router();
const { getAllWordLibraries, getWordLibraryById, getRandomWords } = require('../data/wordLibraries');

// 游戏相关路由
router.get('/rooms', (req, res) => {
  // 获取房间列表
  res.json({ rooms: [] });
});

router.post('/rooms', (req, res) => {
  // 创建新房间
  const { name, maxPlayers } = req.body;
  res.json({ 
    roomId: Date.now().toString(),
    name,
    maxPlayers: maxPlayers || 6,
    currentPlayers: 0
  });
});

router.get('/rooms/:roomId', (req, res) => {
  // 获取房间信息
  const { roomId } = req.params;
  res.json({ 
    roomId,
    name: `房间 ${roomId}`,
    maxPlayers: 6,
    currentPlayers: 0,
    status: 'waiting'
  });
});

// 词库相关路由
router.get('/word-libraries', (req, res) => {
  try {
    const libraries = getAllWordLibraries();
    res.json({ 
      success: true,
      data: libraries 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: '获取词库列表失败',
      error: error.message 
    });
  }
});

router.get('/word-libraries/:id', (req, res) => {
  try {
    const { id } = req.params;
    const library = getWordLibraryById(id);
    
    if (!library) {
      return res.status(404).json({ 
        success: false,
        message: '词库不存在' 
      });
    }
    
    res.json({ 
      success: true,
      data: library 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: '获取词库详情失败',
      error: error.message 
    });
  }
});

router.post('/word-libraries/random', (req, res) => {
  try {
    const { libraryIds, count = 10 } = req.body;
    
    if (!libraryIds || !Array.isArray(libraryIds) || libraryIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: '请提供有效的词库ID列表' 
      });
    }
    
    const words = getRandomWords(libraryIds, count);
    res.json({ 
      success: true,
      data: {
        words,
        count: words.length,
        libraryIds
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: '获取随机词汇失败',
      error: error.message 
    });
  }
});

module.exports = router;