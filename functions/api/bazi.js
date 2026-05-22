/**
 * 八字计算引擎 - Cloudflare Pages Function
 * GET /api/bazi?name=xxx&gender=male&year=1990&month=5&day=15&hour=子时&calendar=solar
 */

// 天干地支
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行映射
const STEM_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};
const BRANCH_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 地支藏干（主要藏干）
const BRANCH_HIDDEN = {
  '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
  '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
  '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
};

// 时辰映射
const HOUR_BRANCH = {
  '子时': '子', '丑时': '丑', '寅时': '寅', '卯时': '卯',
  '辰时': '辰', '巳时': '巳', '午时': '午', '未时': '未',
  '申时': '申', '酉时': '酉', '戌时': '戌', '亥时': '亥'
};

// 月份节气分界点（约数，精确计算需要查万年历）
// 立春约2月4日、惊蛰3月6日、清明4月5日、立夏5月6日、
// 芒种6月6日、小暑7月7日、立秋8月8日、白露9月8日、
// 寒露10月8日、立冬11月8日、大雪12月7日、小寒1月6日
const JIEQI_DAY = [0, 4, 6, 5, 6, 6, 7, 8, 8, 8, 8, 7, 6];

// 年上起月表：年干对应正月（寅月）的月干
const YEAR_MONTH_STEM = {
  '甲': 2, '己': 2,  // 丙寅
  '乙': 4, '庚': 4,  // 戊寅
  '丙': 6, '辛': 6,  // 庚寅
  '丁': 8, '壬': 8,  // 壬寅
  '戊': 0, '癸': 0,  // 甲寅
};

// 日上起时表：日干对应子时的时干
const DAY_HOUR_STEM = {
  '甲': 0, '己': 0,  // 甲子
  '乙': 2, '庚': 2,  // 丙子
  '丙': 4, '辛': 4,  // 戊子
  '丁': 6, '壬': 6,  // 庚子
  '戊': 8, '癸': 8,  // 壬子
};

// 十神关系表：日干与其他干的关系
function getShiShen(dayStem, otherStem) {
  const dayIdx = STEMS.indexOf(dayStem);
  const otherIdx = STEMS.indexOf(otherStem);
  const diff = (otherIdx - dayIdx + 10) % 10;

  // 同我：比肩(同阴阳)、劫财(异阴阳)
  if (diff === 0) return ['比肩', '同五行相助'];
  if (diff === 5) return ['劫财', '同五行竞争'];

  // 我生：食神(同阴阳)、伤官(异阴阳)
  const iCreate = [1, 2, 3, 4, 6, 7, 8, 9]; // diff values for 我生
  const createDiffs = { 1: '食神', 2: '伤官', 3: '偏财', 4: '正财', 6: '七杀', 7: '正官', 8: '偏印', 9: '正印' };
  const createDesc = { 1: '才华表达', 2: '创造突破', 3: '意外之财', 4: '稳定收入', 6: '挑战压力', 7: '事业名声', 8: '非常规学习', 9: '正统学识' };

  return [createDiffs[diff] || '未知', createDesc[diff] || ''];
}

// 计算年柱
function calcYearPillar(year) {
  const idx = (year - 4 + 60) % 60;
  return [STEMS[idx % 10], BRANCHES[idx % 12]];
}

// 计算月柱（需要节气校正）
function calcMonthPillar(yearStem, month, day) {
  // 检查是否在节气前（立春约2月4日）
  let adjMonth = month;
  if (day < JIEQI_DAY[month]) {
    adjMonth = month - 1;
    if (adjMonth < 1) adjMonth = 12;
  }

  const baseStem = YEAR_MONTH_STEM[yearStem] || 0;
  const stemIdx = (baseStem + (adjMonth - 1)) % 10;
  const branchIdx = (adjMonth + 1) % 12; // 寅月为正月(1), 对应index=2

  return [STEMS[stemIdx % 10], BRANCHES[branchIdx % 12]];
}

// 计算日柱（基于公历日期）
function calcDayPillar(year, month, day) {
  // 计算从1900年1月1日到目标日期的天数
  let totalDays = 0;
  for (let y = 1900; y < year; y++) {
    totalDays += isLeapYear(y) ? 366 : 365;
  }
  for (let m = 1; m < month; m++) {
    totalDays += daysInMonth(year, m);
  }
  totalDays += day - 1;

  // 1900年1月1日为甲戌日 (index = 10)
  const idx = (totalDays + 10) % 60;
  return [STEMS[idx % 10], BRANCHES[idx % 12]];
}

// 计算时柱
function calcHourPillar(dayStem, hourName) {
  const branch = HOUR_BRANCH[hourName] || '子';
  const baseStem = DAY_HOUR_STEM[dayStem] || 0;
  const branchIdx = BRANCHES.indexOf(branch);
  const stemIdx = (baseStem + (branchIdx % 12)) % 10;

  return [STEMS[stemIdx % 10], branch];
}

// 辅助函数
function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInMonth(y, m) {
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m === 2 && isLeapYear(y)) return 29;
  return days[m];
}

// 计算五行分布
function calcWuxingDistribution(pillars) {
  const count = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  for (const [gan, zhi] of pillars) {
    count[STEM_WUXING[gan]]++;
    count[BRANCH_WUXING[zhi]]++;
  }
  return count;
}

// 判断日主强弱
function analyzeDayStrength(dayStem, monthBranch, wuxingCount) {
  const dayWuxing = STEM_WUXING[dayStem];
  const monthWuxing = BRANCH_WUXING[monthBranch];

  let score = 0;

  // 月令生扶
  const generateMap = { '木': '水', '火': '木', '土': '火', '金': '土', '水': '金' };
  const sameMap = { '木': '木', '火': '火', '土': '土', '金': '金', '水': '水' };

  if (monthWuxing === generateMap[dayWuxing]) score += 3; // 月令相生
  else if (monthWuxing === sameMap[dayWuxing]) score += 2; // 月令同气
  else score -= 1; // 月令克泄

  // 同类五行数量
  score += wuxingCount[dayWuxing] - 2;

  if (score >= 3) return '偏强';
  if (score >= 1) return '中和偏强';
  if (score >= -1) return '中和';
  if (score >= -3) return '中和偏弱';
  return '偏弱';
}

// 喜用神分析
function calcYongShen(dayWuxing, strength) {
  const overcomes = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };
  const generates = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' };
  const overcomesBy = { '金': '火', '木': '金', '土': '木', '水': '土', '火': '水' };

  if (strength.includes('强')) {
    // 身强：用克泄
    return {
      yongShen: overcomes[dayWuxing] + '/' + generates[dayWuxing],
      yongWuxing: [overcomes[dayWuxing], generates[dayWuxing]],
      principle: '日主偏强，宜克泄耗',
      avoid: dayWuxing
    };
  } else {
    // 身弱：用生扶
    return {
      yongShen: generates[overcomesBy[dayWuxing]] + '/' + dayWuxing,
      yongWuxing: [generates[overcomesBy[dayWuxing]], dayWuxing],
      principle: '日主偏弱，宜生扶',
      avoid: overcomes[dayWuxing]
    };
  }
}

// 性格分析
function analyzePersonality(dayStem, strength) {
  const traits = {
    '甲': { positive: ['正直果敢', '积极进取', '领导力强'], negative: ['刚愎自用', '缺乏变通'] },
    '乙': { positive: ['柔韧灵活', '善解人意', '适应力强'], negative: ['优柔寡断', '依赖性强'] },
    '丙': { positive: ['热情阳光', '光明磊落', '感染力强'], negative: ['急躁冲动', '三分钟热度'] },
    '丁': { positive: ['细腻敏锐', '专注执着', '观察入微'], negative: ['多疑猜忌', '心思过重'] },
    '戊': { positive: ['稳重踏实', '诚信可靠', '包容大度'], negative: ['保守固执', '缺乏激情'] },
    '己': { positive: ['温和谦逊', '务实勤恳', '善解人意'], negative: ['优柔寡断', '缺乏主见'] },
    '庚': { positive: ['刚毅果断', '正义感强', '勇于担当'], negative: ['刚烈易怒', '过于直接'] },
    '辛': { positive: ['精致讲究', '追求完美', '审美力强'], negative: ['挑剔苛刻', '过于敏感'] },
    '壬': { positive: ['智慧通达', '胸怀宽广', '随机应变'], negative: ['随波逐流', '缺乏恒心'] },
    '癸': { positive: ['深谋远虑', '洞察人心', '内敛智慧'], negative: ['多愁善感', '城府较深'] },
  };
  return traits[dayStem] || traits['甲'];
}

// 幸运指南
function calcLuckyGuide(yongWuxing) {
  const guide = {
    '金': { directions: ['西', '西北'], colors: ['白色', '金色', '银色'], numbers: [4, 9], industries: ['金融', '机械', '珠宝', '法律'] },
    '木': { directions: ['东', '东南'], colors: ['绿色', '青色'], numbers: [3, 8], industries: ['教育', '医疗', '文化', '出版'] },
    '水': { directions: ['北'], colors: ['黑色', '蓝色'], numbers: [1, 6], industries: ['物流', '贸易', '传媒', '渔业'] },
    '火': { directions: ['南'], colors: ['红色', '紫色'], numbers: [2, 7], industries: ['餐饮', '能源', '演艺', '互联网'] },
    '土': { directions: ['中', '西南', '东北'], colors: ['黄色', '棕色'], numbers: [5, 0], industries: ['地产', '农业', '建筑', '矿产'] },
  };
  return guide[yongWuxing[0]] || guide['金'];
}

// 当前流年分析
function calcCurrentYearLuck(dayStem, yearPillar, yongShen) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [yearGan, yearZhi] = calcYearPillar(currentYear);

  const dayWuxing = STEM_WUXING[dayStem];
  const yearGanWuxing = STEM_WUXING[yearGan];
  const yearZhiWuxing = BRANCH_WUXING[yearZhi];

  const yongWuxings = yongShen.yongWuxing;

  let overallScore = 0;
  if (yongWuxings.includes(yearGanWuxing)) overallScore += 2;
  if (yongWuxings.includes(yearZhiWuxing)) overallScore += 1;
  if (yearGanWuxing === yongShen.avoid) overallScore -= 1;

  let overall = '平稳';
  if (overallScore >= 2) overall = '大吉';
  else if (overallScore === 1) overall = '小吉';
  else if (overallScore === 0) overall = '平稳';
  else if (overallScore === -1) overall = '需注意';
  else overall = '挑战多';

  return {
    year: currentYear,
    yearPillar: `${yearGan}${yearZhi}`,
    overall,
    career: yongWuxings.includes(yearGanWuxing) ? '有上升机遇' : '宜守不宜攻',
    wealth: yongWuxings.includes(yearZhiWuxing) ? '财运较好' : '理财需谨慎',
    love: overallScore >= 1 ? '人际关系和谐' : '需多沟通体谅',
    health: '注意' + (yongShen.avoid === '火' ? '心血管' : yongShen.avoid === '水' ? '肾泌尿' : yongShen.avoid === '木' ? '肝胆' : yongShen.avoid === '金' ? '呼吸系统' : '脾胃'),
  };
}

// 流月分析
function calcMonthlyLuck(dayStem, yongShen, currentYear) {
  const yearStem_idx = (currentYear - 4) % 10;
  const yearStem = STEMS[yearStem_idx % 10];

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const approximateMonthPillar = calcMonthPillar(yearStem, m, 5); // 取月中
    const monthGanWuxing = STEM_WUXING[approximateMonthPillar[0]];
    let status = '平稳';
    if (yongShen.yongWuxing.includes(monthGanWuxing)) status = '上升';
    if (monthGanWuxing === yongShen.avoid) status = '波动';

    months.push({ month: m, status });
  }
  return months;
}

// ============================================================
// 紫微斗数计算
// ============================================================

// 紫微十二宫
const ZW_PALACES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

// 紫微主星
const ZW_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
// 主星五行
const ZW_STAR_WUXING = {
  '紫微': '土', '天机': '木', '太阳': '火', '武曲': '金', '天同': '水', '廉贞': '火',
  '天府': '土', '太阴': '水', '贪狼': '木', '巨门': '水', '天相': '水', '天梁': '土', '七杀': '金', '破军': '水'
};
// 主星释义
const ZW_STAR_MEANING = {
  '紫微': '帝王之星，主贵气、权威、领导力',
  '天机': '智慧之星，主谋略、应变、策划',
  '太阳': '光明之星，主热情、名声、公益',
  '武曲': '财星，主决断、执行、刚毅',
  '天同': '福星，主温和、享受、人缘',
  '廉贞': '囚星，主执着、精细、次桃花',
  '天府': '库星，主包容、稳重、理财',
  '太阴': '阴星，主温柔、细腻、内秀',
  '贪狼': '桃花星，主交际、才艺、欲望',
  '巨门': '暗星，主口才、是非、钻研',
  '天相': '印星，主协调、辅助、公正',
  '天梁': '荫星，主长寿、庇佑、清高',
  '七杀': '将星，主魄力、开拓、竞争',
  '破军': '耗星，主变革、破坏、创新'
};

function calcZiweiDouShu(yearStem, monthIdx, day, hourIdx, gender) {
  // 命宫：从寅宫起正月，顺数到出生月，再从该宫起子时，逆数到出生时辰
  const mingIdx = (2 + monthIdx - 1 - hourIdx + 12) % 12;
  // 身宫：从寅宫起正月，顺数到出生月，再从该宫起子时，顺数到出生时辰
  const shenIdx = (2 + monthIdx - 1 + hourIdx) % 12;

  // 纳音五行局（简化：基于命宫地支和年干）
  const najiaMap = {
    '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火', '戊辰': '木', '己巳': '木',
    '庚午': '土', '辛未': '土', '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
    '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土', '庚辰': '金', '辛巳': '金',
    '壬午': '木', '癸未': '木', '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
    '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木', '壬辰': '水', '癸巳': '水',
    '甲午': '金', '乙未': '金', '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
    '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金', '甲辰': '火', '乙巳': '火',
    '丙午': '水', '丁未': '水', '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
    '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水', '丙辰': '土', '丁巳': '土',
    '戊午': '火', '己未': '火', '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水'
  };
  const mingGanIdx = (yearStem * 2 + (mingIdx % 2 === 0 ? 0 : 0)) % 10;
  const najiaKey = STEMS[mingGanIdx % 10] + BRANCHES[mingIdx];
  const wuxingJu = najiaMap[najiaKey] || '木';

  // 紫微星位置（简化算法）
  const juNum = { '水': 2, '木': 3, '金': 4, '土': 5, '火': 6 };
  const base = juNum[wuxingJu] || 3;
  const dayMod = day % base;
  // 紫微星在十二宫的位置
  const ziweiIdx = (dayMod === 0 ? (base - 1) : (dayMod - 1) + 2) % 12;

  // 安十四主星
  const starPositions = {};
  const ziweiOrder = ['紫微', '天机', null, '太阳', '武曲', '天同', null, null, '廉贞'];
  const tianfuOrder = ['天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', null, null, null, '破军'];

  let ziweiIdx2 = ziweiIdx;
  for (let i = 0; i < ziweiOrder.length; i++) {
    if (ziweiOrder[i]) {
      starPositions[ziweiOrder[i]] = (ziweiIdx2 + i) % 12;
    }
  }
  const tianfuIdx = (4 - ziweiIdx + 12) % 12;
  for (let i = 0; i < tianfuOrder.length; i++) {
    if (tianfuOrder[i]) {
      starPositions[tianfuOrder[i]] = (tianfuIdx + i) % 12;
    }
  }

  // 命宫主星
  const mingStars = [];
  for (const [star, pos] of Object.entries(starPositions)) {
    if (pos === mingIdx) mingStars.push(star);
  }

  // 身宫主星
  const shenStars = [];
  for (const [star, pos] of Object.entries(starPositions)) {
    if (pos === shenIdx) shenStars.push(star);
  }

  // 命宫三方四正
  const sanfang = [(mingIdx + 4) % 12, (mingIdx + 8) % 12, (mingIdx + 6) % 12];
  const sanfangStars = {};
  for (const [star, pos] of Object.entries(starPositions)) {
    if (sanfang.includes(pos)) {
      if (!sanfangStars[ZW_PALACES[pos % 12]]) sanfangStars[ZW_PALACES[pos % 12]] = [];
      sanfangStars[ZW_PALACES[pos % 12]].push(star);
    }
  }

  // 命宫解读
  let mingInterpret = '';
  if (mingStars.length === 0) {
    mingInterpret = '命宫无主星，需借对宫迁移宫之星曜参考。性格较为依赖环境，适应力强但缺乏主见。';
  } else {
    const starNames = mingStars.join('、');
    const meanings = mingStars.map(s => ZW_STAR_MEANING[s] || '').join('；');
    mingInterpret = `命宫坐${starNames}。${meanings}。`;
  }

  // 身宫解读
  let shenInterpret = `身宫落${ZW_PALACES[shenIdx]}，代表后天发展重心在${ZW_PALACES[shenIdx]}领域。`;
  if (shenStars.length > 0) {
    shenInterpret += `身宫有${shenStars.join('、')}坐守，后天运势更添助力。`;
  }

  // 全局解读
  let overallInt = '';
  const allStarsInPalaces = {};
  for (const [star, pos] of Object.entries(starPositions)) {
    if (!allStarsInPalaces[ZW_PALACES[pos]]) allStarsInPalaces[ZW_PALACES[pos]] = [];
    allStarsInPalaces[ZW_PALACES[pos]].push(star);
  }

  // 重点宫位分析
  const keyPalaces = ['命宫', '财帛', '官禄', '夫妻', '田宅'];
  const keyAnalysis = {};
  for (const p of keyPalaces) {
    const idx = ZW_PALACES.indexOf(p);
    const stars = allStarsInPalaces[p] || [];
    if (stars.length > 0) {
      keyAnalysis[p] = `${p}有${stars.join('、')}坐守`;
    } else {
      keyAnalysis[p] = `${p}无主星，需借对宫参考`;
    }
  }

  return {
    mingPalace: ZW_PALACES[mingIdx],
    mingStars,
    mingInterpret,
    shenPalace: ZW_PALACES[shenIdx],
    shenStars,
    shenInterpret,
    wuxingJu,
    ziweiPosition: ZW_PALACES[ziweiIdx],
    allStarsInPalaces,
    keyAnalysis,
    starPositions,
    sanfangStars
  };
}

// ============================================================
// 面相分析（基于五行与性别）
// ============================================================
const MIANGXIANG_BASE = {
  '金': {
    shape: '国字脸或方脸，轮廓分明',
    forehead: '额头宽阔平整，主早运顺利',
    eyes: '眼形偏圆，目光坚定有神',
    nose: '鼻梁挺直，鼻头有肉，主财运稳固',
    mouth: '嘴唇厚薄适中，嘴角微扬',
    ears: '耳廓分明，耳垂较大，主福气',
    career: '宜从事金融、法律、管理类职业',
    love: '感情认真专一，晚婚为佳',
  },
  '木': {
    shape: '长脸或瓜子脸，清秀挺拔',
    forehead: '额头高而饱满，主聪慧好学',
    eyes: '眼形修长，眼光清澈温和',
    nose: '鼻梁较高，山根有力，主中年运好',
    mouth: '嘴唇偏薄，口角分明',
    ears: '耳朵偏高，耳轮清晰',
    career: '宜从事教育、文化、艺术类职业',
    love: '感情细腻，注重精神交流',
  },
  '水': {
    shape: '圆脸或鹅蛋脸，线条柔和',
    forehead: '额头圆润饱满，主智慧通达',
    eyes: '眼大有神，眼睛水灵灵活',
    nose: '鼻头圆润，鼻翼饱满，主财运亨通',
    mouth: '嘴唇丰满，嘴角上扬',
    ears: '耳垂较厚，耳形圆润',
    career: '宜从事商贸、传媒、服务类职业',
    love: '感情丰富，善解人意',
  },
  '火': {
    shape: '倒三角脸或菱形脸，棱角分明',
    forehead: '额角较高，发际线略高',
    eyes: '眼大三白，目光炯炯有神',
    nose: '鼻梁高挺，鼻尖较尖，主果断',
    mouth: '嘴唇偏薄，嘴角分明',
    ears: '耳朵较尖，耳形秀气',
    career: '宜从事演艺、餐饮、能源类职业',
    love: '感情热烈直接，需要磨合',
  },
  '土': {
    shape: '方圆形脸，敦厚稳重',
    forehead: '额头平而宽，主根基稳固',
    eyes: '眼形中正，目光平和沉稳',
    nose: '鼻子端正，鼻头厚重，主财运丰隆',
    mouth: '嘴唇厚实，口形方正',
    ears: '耳朵大而厚实，耳垂厚重',
    career: '宜从事地产、建筑、农业类职业',
    love: '感情忠诚踏实，适合早婚',
  }
};

function calcMianXiang(dayStem, gender) {
  const wuxing = STEM_WUXING[dayStem];
  const base = MIANGXIANG_BASE[wuxing] || MIANGXIANG_BASE['土'];
  const g = gender === 'male';

  // 各部位评分（1-5）
  const scores = {
    '天庭（额头）': 3 + (dayStem === '甲' || dayStem === '乙' ? 1 : dayStem === '丙' || dayStem === '丁' ? 0 : -1),
    '眉眼': 3 + (dayStem === '丙' || dayStem === '丁' ? 1 : 0),
    '鼻（财帛宫）': 3 + (dayStem === '戊' || dayStem === '己' ? 1 : 0),
    '口唇': 3 + (dayStem === '壬' || dayStem === '癸' ? 1 : 0),
    '耳朵（福德宫）': 3 + (dayStem === '庚' || dayStem === '辛' ? 1 : 0),
  };

  // 三停分析
  let santing = '';
  if (STEM_WUXING[dayStem] === '木' || STEM_WUXING[dayStem] === '火') {
    santing = '上停（额头）饱满，主少年运佳，早年得志。中停（眉眼鼻）有力，主中年事业有成。需注意下停（口颏）偏弱，晚年宜稳守。';
  } else if (STEM_WUXING[dayStem] === '土' || STEM_WUXING[dayStem] === '金') {
    santing = '三停均停，早年根基稳固，中年事业渐入佳境，晚运丰厚。整体格局平稳向上。';
  } else {
    santing = '上停圆润主聪慧，中停有力主中年运势上升，下停丰满主晚年福气。整体面相格局良好。';
  }

  // 十二宫简析
  const keyGongs = {
    '命宫（印堂）': '两眉之间，代表一生运势基调。' + (scores['眉眼'] >= 4 ? '印堂开阔，主运势顺畅。' : '需保持开朗心态补益。'),
    '财帛宫（鼻子）': '鼻为财星。' + base.nose + '。',
    '夫妻宫（眼尾）': '眼尾夫妻宫。' + (g ? '宜娶贤内助，夫妻和睦。' : '宜嫁稳重之人，夫荣子贵。'),
    '官禄宫（额头正中）': base.forehead + '。',
    '福德宫（耳朵）': base.ears + '。',
    '田宅宫（上眼皮）': '田宅宫主房产运。' + (scores['眉眼'] >= 4 ? '丰隆有势，主房产运佳。' : '需勤勉积累。'),
  };

  return {
    faceShape: base.shape,
    santing,
    scores,
    keyGongs,
    features: {
      forehead: base.forehead,
      eyes: base.eyes,
      nose: base.nose,
      mouth: base.mouth,
      ears: base.ears
    },
    career: base.career,
    love: base.love,
    overall: santing
  };
}

// ============================================================
// 手相分析
// ============================================================
const SHOUXIANG_BASE = {
  '金': {
    palmType: '方形手掌，掌肉厚实',
    lifeLine: '生命线清晰深长，主健康良好、精力充沛',
    headLine: '智慧线平直清晰，主思维敏捷、判断力强',
    heartLine: '感情线深远直达食指，主感情专一持久',
    fateLine: '命运线起始有力，中年后更为明显',
    mounts: '金星丘丰满，主活力充沛；水星丘有力，主沟通能力强',
    summary: '手相格局方正有力，主做事有原则、执行力强。生命线与智慧线分离，主独立性强。',
  },
  '木': {
    palmType: '长形手掌，手指修长',
    lifeLine: '生命线细长延伸，主寿命绵长、体质偏柔',
    headLine: '智慧线长而弯曲，主思维灵活、创造力强',
    heartLine: '感情线分支较多，主感情丰富细腻',
    fateLine: '命运线蜿蜒而上，主人生多转折和机遇',
    mounts: '木星丘发达，主事业心和领导力；太阴丘饱满，主想象力丰富',
    summary: '手相修长秀丽，主才华横溢、智慧超群。智慧线深长，学业运佳。',
  },
  '水': {
    palmType: '圆形手掌，手指饱满',
    lifeLine: '生命线圆润流长，主体质柔韧、适应力强',
    headLine: '智慧线弯弧优美，主聪明灵巧、善交际',
    heartLine: '感情线柔和通贯，主人缘好、善解人意',
    fateLine: '命运线多枝多叉，主人生路径多元',
    mounts: '太阴丘丰厚，主直觉敏锐；水星丘有力，主财运好',
    summary: '手相圆润柔和，主人际关系和谐、应变力强。感情线通贯，晚年福气深厚。',
  },
  '火': {
    palmType: '锥形手掌，指尖尖锐',
    lifeLine: '生命线粗壮有力，主体质强健、行动力充沛',
    headLine: '智慧线直而有力，主目标明确、决策果断',
    heartLine: '感情线热烈鲜明，主感情投入、敢爱敢恨',
    fateLine: '命运线笔直而上，主事业方向明确',
    mounts: '火星丘发达，主勇气和开拓精神；太阳丘有力，主名声运好',
    summary: '手相刚劲有力，主性格热情果断。太阳线明显，中年后名利双收。',
  },
  '土': {
    palmType: '方形厚掌，手掌宽大',
    lifeLine: '生命线粗壮深长，主体质强健、生命力旺盛',
    headLine: '智慧线平直端正，主思维务实、稳扎稳打',
    heartLine: '感情线粗短清晰，主感情真诚踏实',
    fateLine: '命运线平稳延展，主一生运势稳定',
    mounts: '金星丘和第一火星丘发达，主体力和耐力超群；土星丘有力，主责任心强',
    summary: '手相稳重厚实，主一生安定、财源稳定。各线清晰无断，主运势顺遂。',
  }
};

function calcShouXiang(dayStem, gender) {
  const wuxing = STEM_WUXING[dayStem];
  const base = SHOUXIANG_BASE[wuxing] || SHOUXIANG_BASE['土'];

  return {
    palmType: base.palmType,
    lines: {
      lifeLine: base.lifeLine,
      headLine: base.headLine,
      heartLine: base.heartLine,
      fateLine: base.fateLine
    },
    mounts: base.mounts,
    summary: base.summary,
    advice: `根据手相，建议多关注${wuxing === '火' ? '情绪管理' : wuxing === '水' ? '决策果断性' : wuxing === '木' ? '执行落地' : wuxing === '金' ? '人际关系柔韧度' : '健康作息'}方面的提升。`
  };
}

// ============================================================
// 风水布局（田宅风水）
// ============================================================
function calcFengshui(yongShen, dayWuxing) {
  const yw = yongShen.yongWuxing;
  const aw = yongShen.avoid;

  const fengshuiMap = {
    '金': {
      door: '大门宜朝西或西北，门色白色或金色',
      livingRoom: '客厅宜放金属装饰（铜器、金属摆件），圆形装饰物',
      bedroom: '卧室宜设在房屋西侧，床头朝西或西北',
      kitchen: '厨房灶台不宜正对大门，宜设在东南方位（火克金为用）',
      colors: '装修主色调：白色、金色、银色',
      plants: '宜养富贵竹、金钱树（木生火克金需适量）',
      avoid: '避免过多红色装饰、尖角对着床',
    },
    '木': {
      door: '大门宜朝东或东南，门色绿色或木色',
      livingRoom: '客厅宜放绿色植物，木质家具为主',
      bedroom: '卧室宜设在房屋东侧，床头朝东',
      kitchen: '厨房宜保持通风，避免过旺火气',
      colors: '装修主色调：绿色、青色、原木色',
      plants: '宜养发财树、绿萝、文竹等绿色植物',
      avoid: '避免过多金属装饰、白色过多',
    },
    '水': {
      door: '大门宜朝北，门色黑色或深蓝色',
      livingRoom: '客厅宜设水景（鱼缸、流水摆件），波浪形装饰',
      bedroom: '卧室宜设在房屋北侧，床头朝北',
      kitchen: '厨房宜远离卧室，水火不宜相冲',
      colors: '装修主色调：黑色、深蓝、灰色',
      plants: '宜养水培植物、荷花、铜钱草',
      avoid: '避免过多土黄色装饰、燥热环境',
    },
    '火': {
      door: '大门宜朝南，门色红色或紫色',
      livingRoom: '客厅宜明亮通透，红色点缀，三角形装饰',
      bedroom: '卧室宜设在房屋南侧，注意通风采光',
      kitchen: '厨房宜干净整洁，灶台靠墙不靠窗',
      colors: '装修主色调：暖色系、红色、橙色适度',
      plants: '宜养开花植物、红掌、一品红',
      avoid: '避免过多黑色、水景过大',
    },
    '土': {
      door: '大门宜朝西南或东北，门色黄色或棕色',
      livingRoom: '客厅宜方正格局，方形装饰，陶器摆件',
      bedroom: '卧室宜设在房屋中央或西南侧',
      kitchen: '厨房宜宽大整洁，地砖颜色偏黄',
      colors: '装修主色调：米黄、棕色、大地色',
      plants: '宜养龟背竹、橡皮树等阔叶植物',
      avoid: '避免过多绿色植物（木克土）、潮湿环境',
    }
  };

  const primary = fengshuiMap[yw[0]] || fengshuiMap['土'];
  const secondary = yw[1] && yw[1] !== yw[0] ? fengshuiMap[yw[1]] : null;

  return {
    yongShenFengshui: primary,
    secondaryFengshui: secondary,
    generalAdvice: `根据命局喜${yw.join('、')}，忌${aw}。居家布局以${yw[0]}性为主，${secondary ? '辅以' + yw[1] + '性调和。' : '。'}`,
    quickTips: [
      `大门朝向优先选择${primary.door.split('，')[0].replace('大门宜朝', '')}方`,
      `卧室主色调建议${primary.colors.split('：')[1] || primary.colors}`,
      primary.plants,
      primary.avoid
    ]
  };
}

// ========== API 处理 ==========
export async function onRequestGet(context) {
  try {
  const { request } = context;
  const url = new URL(request.url);
  const params = url.searchParams;

  const name = params.get('name') || '用户';
  const gender = params.get('gender') || 'male';
  const year = parseInt(params.get('year')) || 1990;
  const month = parseInt(params.get('month')) || 1;
  const day = parseInt(params.get('day')) || 1;
  const hourName = params.get('hour') || '子时';
  const calendar = params.get('calendar') || 'solar';

  // TODO: 农历转换（简化处理，实际需要万年历）
  // 这里假设输入都是公历

  // 计算四柱
  const [yearGan, yearZhi] = calcYearPillar(year);
  const [monthGan, monthZhi] = calcMonthPillar(yearGan, month, day);
  const [dayGan, dayZhi] = calcDayPillar(year, month, day);
  const [hourGan, hourZhi] = calcHourPillar(dayGan, hourName);

  const pillars = [
    [yearGan, yearZhi],
    [monthGan, monthZhi],
    [dayGan, dayZhi],
    [hourGan, hourZhi]
  ];

  // 五行分布
  const wuxingCount = calcWuxingDistribution(pillars);

  // 日主强弱
  const strength = analyzeDayStrength(dayGan, monthZhi, wuxingCount);

  // 喜用神
  const yongShen = calcYongShen(STEM_WUXING[dayGan], strength);

  // 性格
  const personality = analyzePersonality(dayGan, strength);

  // 幸运指南
  const luckyGuide = calcLuckyGuide(yongShen.yongWuxing);

  // 流年
  const currentYearLuck = calcCurrentYearLuck(dayGan, [yearGan, yearZhi], yongShen);

  // 流月
  const monthlyLuck = calcMonthlyLuck(dayGan, yongShen, new Date().getFullYear());

  // 日柱十神
  const shiShen = {};
  for (let i = 0; i < 4; i++) {
    const gan = pillars[i][0];
    shiShen[['year', 'month', 'day', 'hour'][i]] = getShiShen(dayGan, gan);
  }

  // 紫微斗数
  const ziwei = calcZiweiDouShu(STEMS.indexOf(yearGan), month - 1, day, BRANCHES.indexOf(HOUR_BRANCH[hourName] || '子'), gender);
  // 面相
  const mianxiang = calcMianXiang(dayGan, gender);
  // 手相
  const shouxiang = calcShouXiang(dayGan, gender);
  // 风水
  const fengshui = calcFengshui(yongShen, STEM_WUXING[dayGan]);

  const result = {
    name,
    gender,
    birth: { year, month, day, hour: hourName, calendar },
    pillars: {
      year: [yearGan, yearZhi],
      month: [monthGan, monthZhi],
      day: [dayGan, dayZhi],
      hour: [hourGan, hourZhi]
    },
    dayMaster: dayGan,
    dayWuxing: STEM_WUXING[dayGan],
    wuxingCount,
    strength,
    yongShen,
    personality,
    luckyGuide,
    currentYearLuck,
    monthlyLuck,
    shiShen,
    ziwei,
    mianxiang,
    shouxiang,
    fengshui
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
