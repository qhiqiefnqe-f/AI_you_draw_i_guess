// 系统内置词库数据
const wordLibraries = {
  // 古诗词类
  poetry: {
    id: 'poetry',
    name: '古诗词',
    description: '经典古诗词名句',
    icon: '📜',
    words: [
      '春眠不觉晓',
      '床前明月光',
      '举头望明月',
      '低头思故乡',
      '白日依山尽',
      '黄河入海流',
      '欲穷千里目',
      '更上一层楼',
      '两个黄鹂鸣翠柳',
      '一行白鹭上青天',
      '窗含西岭千秋雪',
      '门泊东吴万里船',
      '红豆生南国',
      '春来发几枝',
      '愿君多采撷',
      '此物最相思',
      '独在异乡为异客',
      '每逢佳节倍思亲',
      '遥知兄弟登高处',
      '遍插茱萸少一人'
    ]
  },

  // 动物类
  animals: {
    id: 'animals',
    name: '动物',
    description: '各种可爱的动物',
    icon: '🐾',
    words: [
      '小猫',
      '小狗',
      '兔子',
      '熊猫',
      '老虎',
      '狮子',
      '大象',
      '长颈鹿',
      '猴子',
      '企鹅',
      '海豚',
      '鲸鱼',
      '蝴蝶',
      '蜜蜂',
      '蜻蜓',
      '青蛙',
      '乌龟',
      '金鱼',
      '小鸟',
      '老鹰',
      '孔雀',
      '天鹅',
      '鸭子',
      '鸡',
      '牛',
      '羊',
      '马',
      '猪',
      '松鼠',
      '刺猬'
    ]
  },

  // 水果类
  fruits: {
    id: 'fruits',
    name: '水果',
    description: '新鲜美味的水果',
    icon: '🍎',
    words: [
      '苹果',
      '香蕉',
      '橙子',
      '葡萄',
      '草莓',
      '西瓜',
      '哈密瓜',
      '桃子',
      '梨',
      '樱桃',
      '蓝莓',
      '柠檬',
      '柚子',
      '芒果',
      '菠萝',
      '猕猴桃',
      '火龙果',
      '荔枝',
      '龙眼',
      '石榴',
      '柿子',
      '杏',
      '李子',
      '椰子',
      '榴莲',
      '山竹',
      '木瓜',
      '无花果',
      '枣',
      '山楂'
    ]
  },

  // 食物类
  foods: {
    id: 'foods',
    name: '美食',
    description: '各种美味食物',
    icon: '🍜',
    words: [
      '饺子',
      '包子',
      '面条',
      '米饭',
      '粥',
      '汤圆',
      '月饼',
      '蛋糕',
      '面包',
      '饼干',
      '巧克力',
      '冰淇淋',
      '火锅',
      '烧烤',
      '炒菜',
      '红烧肉',
      '糖醋里脊',
      '宫保鸡丁',
      '麻婆豆腐',
      '鱼香肉丝',
      '回锅肉',
      '青椒土豆丝',
      '西红柿鸡蛋',
      '酸辣土豆丝',
      '可乐鸡翅',
      '红烧鱼',
      '蒸蛋',
      '凉拌黄瓜',
      '拍黄瓜',
      '凉皮'
    ]
  },

  // 日常用品类
  dailyItems: {
    id: 'dailyItems',
    name: '日常用品',
    description: '生活中的常见物品',
    icon: '🏠',
    words: [
      '牙刷',
      '毛巾',
      '肥皂',
      '洗发水',
      '梳子',
      '镜子',
      '杯子',
      '盘子',
      '碗',
      '筷子',
      '勺子',
      '叉子',
      '刀',
      '锅',
      '电视',
      '冰箱',
      '洗衣机',
      '空调',
      '风扇',
      '台灯',
      '床',
      '枕头',
      '被子',
      '椅子',
      '桌子',
      '书',
      '笔',
      '纸',
      '手机',
      '电脑'
    ]
  },

  // 交通工具类
  vehicles: {
    id: 'vehicles',
    name: '交通工具',
    description: '各种交通工具',
    icon: '🚗',
    words: [
      '汽车',
      '自行车',
      '摩托车',
      '公交车',
      '出租车',
      '地铁',
      '火车',
      '高铁',
      '飞机',
      '轮船',
      '帆船',
      '游艇',
      '潜水艇',
      '热气球',
      '直升机',
      '卡车',
      '救护车',
      '消防车',
      '警车',
      '校车',
      '电动车',
      '滑板',
      '滑板车',
      '三轮车',
      '拖拉机',
      '挖掘机',
      '推土机',
      '吊车',
      '叉车',
      '坦克'
    ]
  }
};

// 获取所有词库列表（不包含具体词汇）
function getAllWordLibraries() {
  return Object.values(wordLibraries).map(library => ({
    id: library.id,
    name: library.name,
    description: library.description,
    icon: library.icon,
    wordCount: library.words.length
  }));
}

// 根据ID获取特定词库
function getWordLibraryById(id) {
  return wordLibraries[id] || null;
}

// 根据ID数组获取多个词库的词汇
function getWordsByLibraryIds(ids) {
  const allWords = [];
  ids.forEach(id => {
    const library = wordLibraries[id];
    if (library) {
      allWords.push(...library.words);
    }
  });
  return allWords;
}

// 随机获取指定数量的词汇
function getRandomWords(libraryIds, count = 10) {
  const allWords = getWordsByLibraryIds(libraryIds);
  if (allWords.length === 0) return [];
  
  // 随机打乱数组
  const shuffled = allWords.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = {
  wordLibraries,
  getAllWordLibraries,
  getWordLibraryById,
  getWordsByLibraryIds,
  getRandomWords
};