/**
 * 八字计算引擎 V2 - 基于《渊海子平》《滴天髓》《三命通会》《子平管见》
 * 紫微斗数计算 V2 - 基于《紫微斗数全书》陈希夷原著 + 倪海厦派算法
 * 
 * 核心改进：
 * 1. 八字：格局认定 + 调候用神 + 大运流年应期
 * 2. 紫微斗数：倪派命宫从日支起 + 一六分隔法安紫微 + 完整四化飞星
 */

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 天干地支五行
const STEM_WUXING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};
const BRANCH_WUXING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

// 地支藏干（主气、中气、余气）
const BRANCH_HIDDEN = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],  // 己主气，癸中气，辛余气
  '寅': ['甲', '丙', '戊'],  // 甲主气，丙中气，戊余气
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],  // 戊主气，乙中气，癸余气
  '巳': ['丙', '庚', '戊'],  // 丙主气，庚中气，戊余气
  '午': ['丁', '己'],        // 丁主气，己中气
  '未': ['己', '丁', '乙'],  // 己主气，丁中气，乙余气
  '申': ['庚', '壬', '戊'],  // 庚主气，壬中气，戊余气
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],  // 戊主气，辛中气，丁余气
  '亥': ['壬', '甲']         // 壬主气，甲中气
};

// 时辰映射
const HOUR_BRANCH = {
  '子时': '子', '丑时': '丑', '寅时': '寅', '卯时': '寅',
  '辰时': '辰', '巳时': '巳', '午时': '午', '未时': '未',
  '申时': '申', '酉时': '酉', '戌时': '戌', '亥时': '亥',
  '早子时': '子', '晚子时': '子'
};

// 节气表（约数，精确需查万年历）
// [小寒, 大寒, 立春, 雨水, 惊蛰, 春分, 清明, 谷雨, 立夏, 小满, 芒种, 夏至, 小暑, 大暑, 立秋, 处暑, 白露, 秋分, 寒露, 霜降, 立冬, 小雪, 大雪, 冬至]
// 月份分界（以节为准，不是初中末）
const JIEQI_BOUNDARY = {
  // 月份: [立春前有, 惊蛰前有, 清明前有, 立夏前有, 芒种前有, 小暑前有, 立秋前有, 白露前有, 寒露前有, 立冬前有, 大雪前有, 小寒前有]
  1: 4,   // 小寒约1月5日
  2: 3,   // 立春约2月3日
  3: 5,   // 惊蛰约3月5日
  4: 4,   // 清明约4月4日
  5: 5,   // 立夏约5月5日
  6: 5,   // 芒种约6月5日
  7: 6,   // 小暑约7月6日
  8: 7,   // 立秋约8月7日
  9: 7,   // 白露约9月7日
  10: 7,  // 寒露约10月8日
  11: 6,  // 立冬约11月7日
  12: 6   // 大雪约12月6日
};

// ============================================================
// 第一部分：四柱排盘核心（精确版）
// ============================================================

// 年上起月表（年干对应正月寅月天干）
// 甲己起丙寅, 乙庚起戊寅, 丙辛起庚寅, 丁壬起壬寅, 戊癸起甲寅
const YEAR_MONTH_STEM = {
  '甲': 2, '己': 2,  // 丙寅（index 2 = 丙）
  '乙': 4, '庚': 4,  // 戊寅
  '丙': 6, '辛': 6,  // 庚寅
  '丁': 8, '壬': 8,  // 壬寅
  '戊': 0, '癸': 0,  // 甲寅
};

// 日上起时表（日干对应子时天干）
// 甲己起甲子, 乙庚起丙子, 丙辛起戊子, 丁壬起庚子, 戊癸起壬子
const DAY_HOUR_STEM = {
  '甲': 0, '己': 0,  // 甲子
  '乙': 2, '庚': 2,  // 丙子
  '丙': 4, '辛': 4,  // 戊子
  '丁': 6, '壬': 6,  // 庚子
  '戊': 8, '癸': 8,  // 壬子
};

// 计算年柱（60甲子）
function calcYearPillar(year) {
  // 以立春为年分界，立春前属前年
  const idx = (year - 4 + 60) % 60;
  return [STEMS[idx % 10], BRANCHES[idx % 12]];
}

// 计算月柱（精确节气）
function calcMonthPillar(yearStem, month, day) {
  // 节气分界：每月以节为界，如立春前仍算丑月
  let adjMonth = month;
  if (day < JIEQI_BOUNDARY[month]) {
    adjMonth = month - 1;
    if (adjMonth < 1) adjMonth = 12;
  }

  const baseStem = YEAR_MONTH_STEM[yearStem] ?? 2;
  const stemIdx = (baseStem + (adjMonth - 1)) % 10;
  const branchIdx = (adjMonth + 1) % 12; // 寅月=1 → index=2

  return [STEMS[stemIdx % 10], BRANCHES[branchIdx % 12]];
}

// 计算日柱（基于公历日期，基准：1900年1月1日 = 甲子）
function calcDayPillar(year, month, day) {
  let totalDays = 0;
  for (let y = 1900; y < year; y++) {
    totalDays += isLeapYear(y) ? 366 : 365;
  }
  for (let m = 1; m < month; m++) {
    totalDays += daysInMonth(year, m);
  }
  totalDays += day - 1;

  // 1900年1月1日 = 甲子 = index 0
  const idx = (totalDays) % 60;
  return [STEMS[idx % 10], BRANCHES[idx % 12]];
}

// 计算时柱
function calcHourPillar(dayStem, hourName) {
  const branch = HOUR_BRANCH[hourName] || '子';
  const baseStem = DAY_HOUR_STEM[dayStem] ?? 0;
  const branchIdx = BRANCHES.indexOf(branch);
  const stemIdx = (baseStem + branchIdx) % 10;
  return [STEMS[stemIdx % 10], branch];
}

// 辅助函数
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInMonth(y, m) {
  const d = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m === 2 && isLeapYear(y)) return 29;
  return d[m];
}

// ============================================================
// 第二部分：格局认定（《子平管见》《渊海子平》）
// ============================================================

// 十神关系
function getShiShen(dayStem, otherStem) {
  const dayIdx = STEMS.indexOf(dayStem);
  const otherIdx = STEMS.indexOf(otherStem);
  const diff = (otherIdx - dayIdx + 10) % 10;

  const map = {
    0: '比肩', 5: '劫财',
    1: '食神', 2: '伤官',
    3: '偏财', 4: '正财',
    6: '七杀', 7: '正官',
    8: '偏印', 9: '正印'
  };
  const desc = {
    0: '同五行相助', 5: '同五行竞争',
    1: '才华表达', 2: '创造突破',
    3: '意外之财', 4: '稳定收入',
    6: '挑战压力', 7: '事业名声',
    8: '非常规学习', 9: '正统学识'
  };

  return [map[diff] || '未知', desc[diff] || ''];
}

// 判断是否官杀混杂
function checkGuanSha(pillars, dayStem) {
  let guanCount = 0; // 正官
  let shaCount = 0;  // 七杀
  let hasYin = false; // 印化

  for (let i = 0; i < 4; i++) {
    const [gan, zhi] = pillars[i];
    const [ss, _] = getShiShen(dayStem, gan);
    if (ss === '正官') guanCount++;
    if (ss === '七杀') shaCount++;
    if (ss === '正印' || ss === '偏印') hasYin = true;
  }

  // 官杀混杂：无印化，且正官七杀并存
  if (guanCount > 0 && shaCount > 0 && !hasYin) return '官杀混杂';
  if (shaCount > 0 && !hasYin) return '七杀无制化';
  if (guanCount > 0) return '正官纯正';
  return '非官杀格';
}

// 格局认定（《子平管见》体系）
function recognizeGeJu(pillars, dayStem, dayBranch) {
  // 统计十神
  const counts = {};
  for (const [gan, zhi] of pillars) {
    const [ss, _] = getShiShen(dayStem, gan);
    counts[ss] = (counts[ss] || 0) + 1;
  }

  // 地支藏干也计算
  for (const [, zhi] of pillars) {
    const hidden = BRANCH_HIDDEN[zhi] || [];
    for (const h of hidden) {
      const [ss, _] = getShiShen(dayStem, h);
      counts[ss] = (counts[ss] || 0) + 0.5; // 地支藏干权重0.5
    }
  }

  let geJuName = '普通格局';
  let geJuType = '未定';
  let principal = '';
  let xiJi = '';

  // 正官格判断
  if ((counts['正官'] || 0) >= 1 && (counts['七杀'] || 0) === 0) {
    geJuName = '正官格';
    geJuType = '正官';
    principal = '以正官为用，柱中天干地支见正官为贵';
    // 正官格喜：财星、印绶；忌：七杀、刑冲破害、贪合忘官
    xiJi = '喜财星生官、印绶护官；忌七杀混杂、刑冲破害、贪合忘官（见财合则失贵）';
  }
  // 偏官格（七杀格）判断
  else if ((counts['七杀'] || 0) >= 1 && (counts['正官'] || 0) === 0) {
    geJuName = '偏官格（七杀格）';
    geJuType = '七杀';
    principal = '以七杀为用，身强有制为贵';
    // 偏官格喜：食神制杀、伤官架杀、羊刃合杀、印绶化杀
    xiJi = '喜食神制杀、伤官架杀（阴日）、羊刃合杀、印绶化杀；忌官杀混杂无印';
  }
  // 时上偏官格
  else if ((counts['七杀'] || 0) === 1 && pillars[3][1] === dayBranch) {
    geJuName = '时上偏官格（时上一位贵）';
    geJuType = '七杀';
    principal = '时柱见一位七杀，不杂他杀，格局纯粹';
    xiJi = '喜财星生杀（财滋七杀）、食神制杀、羊刃合杀；忌伤官/食神过盛无财';
  }
  // 正财格
  else if ((counts['正财'] || 0) >= 1 && (counts['偏财'] || 0) === 0 && (counts['七杀'] || 0) === 0) {
    geJuName = '正财格';
    geJuType = '正财';
    principal = '以正财为用，财星有气（地支藏干）为贵';
    xiJi = '喜身弱运逢杀（杀可制比护财）；忌比肩分财、禄冲马亡';
  }
  // 偏财格
  else if ((counts['偏财'] || 0) >= 1 && (counts['正财'] || 0) === 0) {
    geJuName = '偏财格';
    geJuType = '偏财';
    principal = '以偏财为用，异乡发迹之象';
    xiJi = '喜木火通根（金空则鸣）；忌身弱财旺、羊刃被冲';
  }
  // 食神格
  else if ((counts['食神'] || 0) >= 1 && (counts['伤官'] || 0) === 0) {
    geJuName = '食神格';
    geJuType = '食神';
    principal = '以食神为用，寿星之名，泄秀之美';
    xiJi = '喜身强财透、印绶生身；忌刑冲、枭神夺食、官杀混杂';
  }
  // 伤官格
  else if ((counts['伤官'] || 0) >= 1 && (counts['食神'] || 0) === 0) {
    geJuName = '伤官格';
    geJuType = '伤官';
    principal = '以伤官为用，创造力强，叛逆之星';
    xiJi = '喜配财星（伤官生财）、印绶约制（伤官见官为祸）；忌官杀直接相冲';
  }
  // 印绶格
  else if ((counts['正印'] || 0) >= 1 || (counts['偏印'] || 0) >= 1) {
    if ((counts['正印'] || 0) >= (counts['偏印'] || 0)) {
      geJuName = '正印格';
    } else {
      geJuName = '偏印格（枭神格）';
    }
    geJuType = '印';
    principal = '以印绶为用，护身之本，文贵之象';
    xiJi = '喜官杀生印、财星破印（忌财太重）；偏印忌枭神夺食';
  }

  return { geJuName, geJuType, principal, xiJi, counts, guanShaStatus: checkGuanSha(pillars, dayStem) };
}

// ============================================================
// 第三部分：调候用神（《滴天髓》《穷通宝鉴》核心）
// ============================================================

// 调候原则：寒需暖（丙丁），燥需润（壬癸）
// 命局过寒（生于冬月），用丙丁火；命局过燥（生于夏月），用壬癸水
function calcTiaoHou(monthBranch, dayStem, wuxingCount) {
  const monthWx = BRANCH_WUXING[monthBranch];
  const winterBranches = ['亥', '子', '丑'];
  const summerBranches = ['巳', '午', '未'];
  const springBranches = ['寅', '卯', '辰'];
  const autumnBranches = ['申', '酉', '戌'];

  let tiaoHou = '';
  let tiaoHouDesc = '';
  let needWarm = false; // 寒命需要暖
  let needCool = false; // 热命需要润

  // 冬月（亥子丑）：寒
  if (winterBranches.includes(monthBranch)) {
    needWarm = true;
    const fireCount = wuxingCount['火'] || 0;
    if (fireCount === 0) {
      tiaoHou = '丙、丁';
      tiaoHouDesc = `生于寒冬（月令${monthBranch}），命局偏寒，亟需丙丁火暖局驱寒。丙火为最优先用神，丁火次之。`;
    } else if (fireCount === 1) {
      tiaoHou = '丙';
      tiaoHouDesc = `生于寒冬，月令${monthBranch}有火但力不足，需丙火透干暖局。`;
    } else {
      tiaoHou = '已有火，调候基本合格';
      tiaoHouDesc = `月令${monthBranch}但火气尚可，调候压力不大。`;
    }
  }
  // 夏月（巳午未）：热
  else if (summerBranches.includes(monthBranch)) {
    needCool = true;
    const waterCount = wuxingCount['水'] || 0;
    if (waterCount === 0) {
      tiaoHou = '壬、癸';
      tiaoHouDesc = `生于炎夏（月令${monthBranch}），命局偏燥，亟需壬癸水润燥解炎。壬水为最优先用神，癸水次之。`;
    } else if (waterCount === 1) {
      tiaoHou = '壬';
      tiaoHouDesc = `生于炎夏，月令${monthBranch}有水但力不足，需壬水透干润局。`;
    } else {
      tiaoHou = '已有水，调候基本合格';
      tiaoHouDesc = `月令${monthBranch}但水气尚可，调候压力不大。`;
    }
  }
  // 春季：温和，少燥少寒
  else if (springBranches.includes(monthBranch)) {
    tiaoHou = '少用调候，慎用金水';
    tiaoHouDesc = `生于春月，木旺之令，宜先用火（食伤生财），次用水润。`;
  }
  // 秋季：凉爽，少热少燥
  else if (autumnBranches.includes(monthBranch)) {
    tiaoHou = '少用调候，慎用木火';
    tiaoHouDesc = `生于秋月，金旺之令，宜先用水（印绶生身），次用火调候。`;
  }

  return { tiaoHou, tiaoHouDesc, needWarm, needCool };
}

// 用神选取（结合格局 + 调候）
function calcYongShen(dayStem, strength, geJu, tiaoHou, wuxingCount) {
  const dayWx = STEM_WUXING[dayStem];
  
  const overcomes = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };
  const generates = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' };
  const overcomesBy = { '金': '火', '木': '金', '土': '木', '水': '土', '火': '水' };

  let yongShen = [];
  let yongDesc = '';
  let avoidWuxing = [];

  // 第一优先级：调候（如果需要）
  if (tiaoHou.needWarm && !tiaoHou.tiaoHou.includes('已有')) {
    if (tiaoHou.tiaoHou.includes('丙')) {
      yongShen.push('火');
      avoidWuxing.push('水');
    }
    if (tiaoHou.tiaoHou.includes('丁')) {
      yongShen.push('火');
    }
  }
  if (tiaoHou.needCool && !tiaoHou.tiaoHou.includes('已有')) {
    if (tiaoHou.tiaoHou.includes('壬')) {
      yongShen.push('水');
      avoidWuxing.push('土');
    }
    if (tiaoHou.tiaoHou.includes('癸')) {
      yongShen.push('水');
    }
  }

  // 第二优先级：格局用神
  const geType = geJu.geJuType;
  if (['正官', '七杀'].includes(geType)) {
    // 官杀格：用印化杀，或用食神制杀
    if (wuxingCount['印'] >= 1 || wuxingCount['正印'] >= 1 || wuxingCount['偏印'] >= 1) {
      yongShen.push('印');
    } else if (wuxingCount['食神'] >= 1) {
      yongShen.push('食神');
    } else if (wuxingCount['伤官'] >= 1) {
      yongShen.push('伤官');
    }
    if (geType === '正官') {
      yongShen.push('财');
      avoidWuxing.push('伤官');
    }
    if (geType === '七杀') {
      avoidWuxing.push('官');
    }
  } else if (['正财', '偏财'].includes(geType)) {
    yongShen.push('财', '官');
    if (strength.includes('弱')) yongShen.push('印');
  } else if (geType === '食神') {
    yongShen.push('财', '印');
    avoidWuxing.push('枭');
  } else if (geType === '伤官') {
    yongShen.push('财', '印');
    avoidWuxing.push('官');
  } else if (geType === '印') {
    yongShen.push('官', '财');
    avoidWuxing.push('财太重');
  }

  // 第三优先级：日主强弱
  if (strength.includes('强') || strength.includes('旺')) {
    // 身强：宜克泄耗
    if (yongShen.length === 0) {
      yongShen.push(overcomes[dayWx]);
      yongShen.push(generates[dayWx]);
    }
  } else if (strength.includes('弱') || strength.includes('衰')) {
    // 身弱：宜生扶
    if (yongShen.length === 0) {
      yongShen.push(generates[overcomesBy[dayWx]]);
      yongShen.push(dayWx);
    }
  }

  // 去重
  yongShen = [...new Set(yongShen)];
  avoidWuxing = [...new Set(avoidWuxing)];

  return {
    yongShen,
    yongDesc: `用神：${yongShen.join('、')}；忌神：${avoidWuxing.join('、')}`,
    principle: `${geJu.geJuName}，${tiaoHou.tiaoHouDesc} 格局认定：${geJu.principal}`,
    tiaoHou: tiaoHou.tiaoHou,
    tiaoHouDesc: tiaoHou.tiaoHouDesc,
    geJu: geJu.geJuName,
    avoid: avoidWuxing
  };
}

// ============================================================
// 第四部分：日主强弱分析（更精确）
// ============================================================

function analyzeDayStrength(dayStem, monthBranch, wuxingCount) {
  const dayWx = STEM_WUXING[dayStem];
  const monthWx = BRANCH_WUXING[monthBranch];

  const generateMap = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const overcomeMap = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
  const sameMap = { '木': '木', '火': '火', '土': '土', '金': '金', '水': '水' };
  const overcomeByMap = { '木': '金', '火': '水', '土': '木', '金': '火', '水': '土' };

  let score = 0;

  // 一、月令权重（最重要）
  if (monthWx === generateMap[dayWx]) {
    score += 4; // 我生之令，有力
  } else if (monthWx === sameMap[dayWx]) {
    score += 2; // 同类得令
  } else if (monthWx === overcomeMap[dayWx]) {
    score -= 4; // 我克之令，受制最重
  } else if (monthWx === overcomeByMap[dayWx]) {
    score -= 3; // 克我之令，耗身
  } else {
    score -= 1; // 我泄之令
  }

  // 二、天干地支五行计数
  const selfCount = wuxingCount[dayWx] || 0;
  score += (selfCount - 2) * 1.5;

  // 三、印绶生助
  const yinCount = (wuxingCount['正印'] || 0) + (wuxingCount['偏印'] || 0);
  score += yinCount * 0.8;

  // 四、官杀克泄
  const guanCount = (wuxingCount['正官'] || 0) + (wuxingCount['七杀'] || 0);
  score -= guanCount * 1.0;

  // 五、财星耗身
  const caiCount = (wuxingCount['正财'] || 0) + (wuxingCount['偏财'] || 0);
  score -= caiCount * 0.6;

  if (score >= 4) return '极强';
  if (score >= 2) return '偏强';
  if (score >= -1) return '中和';
  if (score >= -3) return '偏弱';
  return '极弱';
}

// ============================================================
// 第五部分：大运流年分析（合冲刑害触发）
// ============================================================

// 大运排法：命主出生后第一个节气的年龄
function calcDaYun(startAge, pillars) {
  const dasan = [];
  for (let i = 0; i < 8; i++) {
    const age = startAge + i * 10;
    const pillarIdx = i % 12;
    dasan.push({
      age: `${age}-${age + 9}`,
      yearPillar: `${pillars[pillarIdx][0]}${pillars[pillarIdx][1]}`,
      branch: pillars[pillarIdx][1],
      wuxing: BRANCH_WUXING[pillars[pillarIdx][1]]
    });
  }
  return dasan;
}

// 流年分析（合冲刑害触发）
function analyzeLiuNian(yearStem, yearBranch, pillars, yongShen, dayStem) {
  const yearGanWx = STEM_WUXING[yearStem];
  const yearZhiWx = BRANCH_WUXING[yearBranch];
  const dayGanWx = STEM_WUXING[dayStem];

  const yongWuxing = yongShen.yongShen || [];
  const avoidWuxing = yongShen.avoid || [];

  let score = 0;
  let factors = [];

  // 喜用神在年干
  if (yongWuxing.includes(yearGanWx)) {
    score += 2;
    factors.push(`年干${yearStem}为喜用`);
  }
  // 喜用神在年支
  if (yongWuxing.includes(yearZhiWx)) {
    score += 1;
    factors.push(`年支${yearBranch}为喜用`);
  }
  // 忌神在年干
  if (avoidWuxing.includes(yearGanWx)) {
    score -= 1;
    factors.push(`年干${yearStem}为忌`);
  }

  // 合冲刑害判断
  let triggerType = '';
  // 年支与日支关系
  const dayBranch = pillars[2][1];
  const branchDiff = Math.abs(BRANCHES.indexOf(yearBranch) - BRANCHES.indexOf(dayBranch));

  if (branchDiff === 6) {
    triggerType = '冲';
    score -= 1; // 冲则动
  } else if (branchDiff === 2 || branchDiff === 10) {
    triggerType = '刑';
    score -= 1;
  } else if ([3, 7].includes(branchDiff)) {
    triggerType = '害';
  } else if (branchDiff === 4 || branchDiff === 8) {
    triggerType = '合';
    score += 1; // 合则聚
  }

  let overall = score >= 2 ? '大吉' : score >= 1 ? '小吉' : score === 0 ? '平稳' : score >= -1 ? '需注意' : '挑战';

  return {
    yearPillar: `${yearStem}${yearBranch}`,
    yearGanWx,
    yearZhiWx,
    overall,
    score,
    factors,
    triggerType,
    career: score >= 1 ? '有上升机遇' : '宜守不宜攻',
    wealth: yongWuxing.includes(yearZhiWx) ? '财运较好' : '理财需谨慎',
    health: '注意' + (avoidWuxing.includes('火') ? '心血管' : avoidWuxing.includes('水') ? '肾泌尿' : avoidWuxing.includes('木') ? '肝胆' : '脾胃')
  };
}

// ============================================================
// 第六部分：性格分析（综合格局）
// ============================================================

function analyzePersonality(dayStem, strength, geJu) {
  const isStrong = strength.includes('强') || strength.includes('旺');
  const isWeak = strength.includes('弱') || strength.includes('衰');

  const traits = {
    '甲': {
      base: ['正直果敢', '积极进取', '领导力强', '有担当'],
      strong: ['魄力十足，敢于承担重任，能带领团队突破困境，决策果断，执行力强'],
      weak: ['外表谦和，内心常有远大志向但不轻易外露，积蓄力量等待时机'],
      flaws: ['刚愎自用', '缺乏变通', '过于强势']
    },
    '乙': {
      base: ['柔韧灵活', '善解人意', '适应力强', '感知敏锐'],
      strong: ['以柔克刚，善于周旋，能在复杂环境中游刃有余，人际关系圆融'],
      weak: ['缺乏主见，容易被他人意见左右，需要更多独立做决定的锻炼'],
      flaws: ['优柔寡断', '依赖性强', '易妥协']
    },
    '丙': {
      base: ['热情阳光', '光明磊落', '感染力强', '行动力快'],
      strong: ['领导欲强，舞台越大越发光，适合担任发言人或项目主导者'],
      weak: ['热情来得快去得也快，专注力不足，需培养持久力和深度'],
      flaws: ['急躁冲动', '三分钟热度', '情绪波动大']
    },
    '丁': {
      base: ['细腻敏锐', '专注执着', '观察入微', '内敛深沉'],
      strong: ['洞察力极强，能发现他人忽视的细节，专注时无人能比'],
      weak: ['心思过重，想太多而行动力不足，需学会"先完成再完美"'],
      flaws: ['多疑猜忌', '城府较深', '情感上易患得患失']
    },
    '戊': {
      base: ['稳重踏实', '诚信可靠', '包容大度', '有根基'],
      strong: ['最适合做长期项目负责人，稳定输出，是团队最可依赖的后盾'],
      weak: ['稳重之下有保守倾向，需多接触新事物打破舒适圈'],
      flaws: ['保守固执', '不善于表达情感', '有时过于计较']
    },
    '己': {
      base: ['温和谦逊', '务实勤恳', '善于调和', '脚踏实地'],
      strong: ['最适合做协调者，能化解矛盾，团队氛围的"定海神针"'],
      weak: ['缺乏开创性，需要明确方向和目标才能发挥最大价值'],
      flaws: ['优柔寡断', '缺乏主见', '有时过于迁就']
    },
    '庚': {
      base: ['刚毅果断', '正义感强', '勇于担当', '法治精神'],
      strong: ['改革者和清道夫，适合推动制度建立、拨乱反正、正本清源'],
      weak: ['刚烈易怒，沟通方式过于直接，需注意表达技巧'],
      flaws: ['过于直接', '不懂圆滑', '易树敌']
    },
    '辛': {
      base: ['精致讲究', '追求完美', '审美力强', '自尊心强'],
      strong: ['对品质有极高敏感度，最适合质量管控、精密技术、设计审美类工作'],
      weak: ['完美主义导致行动力不足，需接受"足够好"也是好'],
      flaws: ['挑剔苛刻', '过于敏感', '容易自我施压']
    },
    '壬': {
      base: ['智慧通达', '胸怀宽广', '随机应变', '富有谋略'],
      strong: ['最擅长跨界整合资源，适合新业务开拓、政策研究、战略规划'],
      weak: ['想法太多行动太少，需要找到一个聚焦方向才能有成'],
      flaws: ['随波逐流', '缺乏恒心', '方向易飘忽']
    },
    '癸': {
      base: ['深谋远虑', '洞察人心', '内敛智慧', '直觉敏锐'],
      strong: ['最适合研究类、心理学、医疗健康等需要深度洞察的领域'],
      weak: ['容易陷入自己的精神世界，与现实的连接需要加强'],
      flaws: ['多愁善感', '逃避现实', '情绪内敛过深']
    }
  };

  const t = traits[dayStem] || traits['甲'];
  const core = isStrong ? t.strong : isWeak ? t.weak : t.base;

  // 结合格局的补充说明
  let geJuSupplement = '';
  if (geJu.geJuType === '正官') {
    geJuSupplement = ' 正官星透出，为人正直，有责任心，重视名声和地位。';
  } else if (geJu.geJuType === '七杀') {
    geJuSupplement = ' 七杀星在命，具有强烈竞争意识和开拓精神，敢拼敢闯。';
  } else if (geJu.geJuType === '食神') {
    geJuSupplement = ' 食神星透出，为人温和有福气，创造力和表达能力突出。';
  } else if (geJu.geJuType === '伤官') {
    geJuSupplement = ' 伤官星透出，思维活跃，才华出众，不甘于平凡。';
  }

  return {
    traits: [...new Set([...t.base, ...core])].slice(0, 6),
    flaws: t.flaws,
    core: core[0],
    geJuSupplement
  };
}

// 幸运指南
function calcLuckyGuide(yongShen) {
  const w = yongShen.yongShen[0] || '金';
  const guide = {
    '金': { directions: ['西', '西北'], colors: ['白色', '金色', '银色'], numbers: [4, 9], industries: ['金融', '机械', '珠宝', '法律'] },
    '木': { directions: ['东', '东南'], colors: ['绿色', '青色'], numbers: [3, 8], industries: ['教育', '医疗', '文化', '出版'] },
    '水': { directions: ['北'], colors: ['黑色', '蓝色'], numbers: [1, 6], industries: ['物流', '贸易', '传媒', '渔业'] },
    '火': { directions: ['南'], colors: ['红色', '紫色'], numbers: [2, 7], industries: ['餐饮', '能源', '演艺', '互联网'] },
    '土': { directions: ['中', '西南', '东北'], colors: ['黄色', '棕色'], numbers: [5, 0], industries: ['地产', '农业', '建筑', '矿产'] },
  };
  return guide[w] || guide['金'];
}

// 五行分布
function calcWuxingDistribution(pillars) {
  const count = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
  for (const [gan, zhi] of pillars) {
    count[STEM_WUXING[gan]]++;
    const hidden = BRANCH_HIDDEN[zhi] || [];
    for (const s of hidden) count[STEM_WUXING[s]]++;
  }
  return count;
}

// ============================================================
// 第七部分：紫微斗数 V2（倪派 +《紫微斗数全书》古籍）
// ============================================================

const ZW_PALACES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

// 十四正曜
const ZW14_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

// 六吉星
const ZW_LUCKY = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺'];
// 六煞星
const ZW_FIERCE = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
// 辅星
const ZW_AUX = ['禄存', '天马', '天姚', '红鸾'];

// 十四正曜五行
const ZW_STAR_WUXING = {
  '紫微': '土', '天机': '木', '太阳': '火', '武曲': '金', '天同': '水', '廉贞': '火',
  '天府': '土', '太阴': '水', '贪狼': '木', '巨门': '水', '天相': '水', '天梁': '土', '七杀': '金', '破军': '水'
};

// 十四正曜释义（《紫微斗数全书》原文）
const ZW_STAR_MEANING = {
  '紫微': '帝王之星，司一天仪之象。主贵气、权威、领导力。',
  '天机': '智慧之星，善识兵法。主谋略、应变、策划。',
  '太阳': '光明之星，主热情、名声、公益。',
  '武曲': '财星，司财库。主决断、执行、刚毅。',
  '天同': '福星，化气为福。主温和、享受、人缘。',
  '廉贞': '囚星，次桃花。主执着、精细、桃花。',
  '天府': '库星，化气为令。主包容、稳重、理财。',
  '太阴': '阴星，化气为富。主温柔、细腻、内秀。',
  '贪狼': '桃花星，主交际、才艺、欲望。',
  '巨门': '暗星，口舌是非。主口才、钻研、细腻。',
  '天相': '印星，佐帝威权。主协调、辅助、公正。',
  '天梁': '荫星，化气为荫。主长寿、庇佑、清高。',
  '七杀': '将星，司权。主魄力、开拓、竞争。',
  '破军': '耗星，司破。主变革、破坏、创新。'
};

// 年干四化表（《紫微斗数全书》体系）
const SIHUA_TABLE = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' }
};

// 禄存表（年干起子）
const LUCUN_TABLE = {
  '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午', '戊': '巳',
  '己': '午', '庚': '申', '辛': '酉', '壬': '亥', '癸': '子'
};

// 天魁天钺表
const KUIYUE_TABLE = {
  '甲': { kui: '丑', yue: '未' }, '戊': { kui: '丑', yue: '未' }, '庚': { kui: '丑', yue: '未' },
  '乙': { kui: '子', yue: '申' }, '己': { kui: '子', yue: '申' },
  '丙': { kui: '亥', yue: '酉' }, '丁': { kui: '亥', yue: '酉' },
  '辛': { kui: '午', yue: '寅' },
  '壬': { kui: '卯', yue: '巳' }, '癸': { kui: '卯', yue: '巳' }
};

// 天姚红鸾表（年支起）
const YAOLAN_TABLE = {
  '子': { yao: '丑', luan: '卯' },
  '丑': { yao: '寅', luan: '卯' },
  '寅': { yao: '卯', luan: '辰' },
  '卯': { yao: '辰', luan: '巳' },
  '辰': { yao: '巳', luan: '午' },
  '巳': { yao: '午', luan: '未' },
  '午': { yao: '未', luan: '申' },
  '未': { yao: '申', luan: '酉' },
  '申': { yao: '酉', luan: '戌' },
  '酉': { yao: '戌', luan: '亥' },
  '戌': { yao: '亥', luan: '子' },
  '亥': { yao: '子', luan: '丑' }
};

// 纳音五行局（年干年支查表）
const NAJIA_TABLE = {
  '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火',
  '戊辰': '木', '己巳': '木', '庚午': '土', '辛未': '土',
  '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
  '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土',
  '庚辰': '金', '辛巳': '金', '壬午': '木', '癸未': '木',
  '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
  '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木',
  '壬辰': '水', '癸巳': '水', '甲午': '金', '乙未': '金',
  '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
  '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金',
  '甲辰': '火', '乙巳': '火', '丙午': '水', '丁未': '水',
  '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
  '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水',
  '丙辰': '土', '丁巳': '土', '戊午': '火', '己未': '火',
  '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水'
};

// 倪派：紫微星「一六分隔法」
// 核心规则：
// 1. diao = (日干index*6 + 日支index) % 60 % 12
// 2. diao = 0 → 紫微在丑宫；diao = 6 → 紫微在未宫
// 3. 命宫从日支起（口诀：命宫起日支）
// 4. 身宫 = 命宫 + 月支 + 时支（顺数）
function getDiao(dayStem, dayBranch) {
  const stemIdx = STEMS.indexOf(dayStem);
  const branchIdx = BRANCHES.indexOf(dayBranch);
  const day60 = (stemIdx * 6 + branchIdx) % 60;
  return day60 % 12;
}

// 倪派安命宫（从日支起）
function getMingGong(dayBranch) {
  return BRANCHES.indexOf(dayBranch);
}

// 倪派安身宫（命宫 + 月支 + 时支，顺数）
function getShenGong(mingGong, monthBranch, hourBranch) {
  return (mingGong + BRANCHES.indexOf(monthBranch) + BRANCHES.indexOf(hourBranch)) % 12;
}

// 倪派安十四主星
// diao = 紫微星所在宫位索引（从寅开始数0-11）
// diao=0(丑)→紫微在丑; diao=1(寅)→紫微在寅; 以此类推
function place14Stars(diao) {
  const positions = {};

  // 紫微系（逆布）：紫微逆行，隔一宫布一星
  // diao → 紫微位置（寅=0, 卯=1, 辰=2...丑=10, 子=11）
  positions['紫微'] = diao;
  positions['天机'] = (diao - 1 + 12) % 12; // 隔一宫逆行
  positions['太阳'] = (diao + 2) % 12;       // 隔一宫顺行
  positions['武曲'] = (diao + 3) % 12;
  positions['天同'] = (diao + 4) % 12;
  positions['廉贞'] = (diao + 7) % 12;

  // 天府系（顺布）：天府从对宫起，隔一宫布一星
  // 天府永远与紫微相对（紫微天府，隔六宫相望）
  const tianfuIdx = (diao + 6) % 12;
  positions['天府'] = tianfuIdx;
  positions['太阴'] = (tianfuIdx + 1) % 12;
  positions['贪狼'] = (tianfuIdx + 2) % 12;
  positions['巨门'] = (tianfuIdx + 3) % 12;
  positions['天相'] = (tianfuIdx + 4) % 12;
  positions['天梁'] = (tianfuIdx + 5) % 12;
  positions['七杀'] = (tianfuIdx + 6) % 12;
  positions['破军'] = (tianfuIdx + 10) % 12;

  return positions;
}

// 安四化（《紫微斗数全书》体系）
function placeSiHua(yearStem, starPositions) {
  const siHua = SIHUA_TABLE[yearStem] || SIHUA_TABLE['甲'];
  const result = {};
  for (const [type, starName] of Object.entries(siHua)) {
    if (starPositions[starName] !== undefined) {
      const typeName = type === 'lu' ? '禄' : type === 'quan' ? '权' : type === 'ke' ? '科' : '忌';
      result[starName] = { type: typeName, palace: ZW_PALACES[starPositions[starName]] };
    }
  }
  return result;
}

// 安六吉星
function placeLuckyStars(yearStem, monthBranch, hourBranch) {
  const kuiyue = KUIYUE_TABLE[yearStem] || KUIYUE_TABLE['甲'];
  const monthIdx = BRANCHES.indexOf(monthBranch);
  const hourIdx = BRANCHES.indexOf(hourBranch);

  return {
    '文昌': (10 - hourIdx + 12) % 12,  // 戌上逆数
    '文曲': (4 + hourIdx) % 12,         // 辰上顺数
    '左辅': (4 + monthIdx) % 12,        // 辰上顺数月支
    '右弼': (10 - monthIdx + 12) % 12, // 戌上逆数月支
    '天魁': BRANCHES.indexOf(kuiyue.kui),
    '天钺': BRANCHES.indexOf(kuiyue.yue)
  };
}

// 安六煞星
function placeFierceStars(yearStem, yearBranch, hourBranch) {
  const lucunBranch = LUCUN_TABLE[yearStem] || '寅';
  const lucunIdx = BRANCHES.indexOf(lucunBranch);
  const yearIdx = BRANCHES.indexOf(yearBranch);
  const hourIdx = BRANCHES.indexOf(hourBranch);

  // 火星铃星（按年支时支起法）
  const marsBase = (yearIdx % 2 === 0) ? (4 + hourIdx) % 12 : (10 - hourIdx + 12) % 12;

  return {
    '擎羊': (lucunIdx + 1) % 12,       // 禄存前一宫
    '陀罗': (lucunIdx - 1 + 12) % 12,  // 禄存后一宫
    '火星': marsBase,
    '铃星': (marsBase + 6) % 12,
    '地空': (11 - hourIdx + 12) % 12, // 亥上逆数
    '地劫': (11 + hourIdx) % 12        // 亥上顺数
  };
}

// 安禄存天马
function placeAuxStars(yearStem, yearBranch) {
  const lucunBranch = LUCUN_TABLE[yearStem] || '寅';
  const lucunIdx = BRANCHES.indexOf(lucunBranch);

  const tianmaMap = { '寅': '申', '申': '寅', '巳': '亥', '亥': '巳' };
  const tianmaIdx = BRANCHES.indexOf(tianmaMap[yearBranch] || '申');

  return { '禄存': lucunIdx, '天马': tianmaIdx };
}

// 安天姚红鸾
function placeYaoLuan(yearBranch) {
  const yaolan = YAOLAN_TABLE[yearBranch] || YAOLAN_TABLE['子'];
  return {
    '天姚': BRANCHES.indexOf(yaolan.yao),
    '红鸾': BRANCHES.indexOf(yaolan.luan)
  };
}

// 亮度判断（《紫微斗数全书》庙旺利陷）
function getStarBrightness(starName, branchIdx) {
  // 简化：基于星曜五行与宫位地支五行的关系
  const starWx = ZW_STAR_WUXING[starName];
  const branchWx = BRANCH_WUXING[BRANCHES[branchIdx]];

  if (starWx === branchWx) return '庙'; // 得令
  if ((starWx === '木' && branchWx === '水') || (starWx === '火' && branchWx === '木') ||
      (starWx === '土' && branchWx === '火') || (starWx === '金' && branchWx === '土') ||
      (starWx === '水' && branchWx === '金')) return '旺'; // 相生
  if ((starWx === '水' && branchWx === '木') || (starWx === '木' && branchWx === '火') ||
      (starWx === '火' && branchWx === '土') || (starWx === '土' && branchWx === '金') ||
      (starWx === '金' && branchWx === '水')) return '得'; // 我生
  if ((starWx === '木' && branchWx === '土') || (starWx === '土' && branchWx === '水') ||
      (starWx === '水' && branchWx === '火') || (starWx === '火' && branchWx === '金') ||
      (starWx === '金' && branchWx === '木')) return '利'; // 我克
  return '陷'; // 被克或失地
}

// 大限计算（从命宫起，每运10年）
function calcDaYun_ziwei(mingGong, birthYear) {
  const dasan = [];
  // 大限起始年龄（按年支起）
  const yearBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const yearIdx = yearBranches.indexOf(BRANCHES[mingGong]) % 3;
  const startAge = 8 + yearIdx * 4; // 8, 12, 16, 20 循环

  for (let i = 0; i < 8; i++) {
    const age = startAge + i * 10;
    const palaceIdx = (mingGong + i) % 12;
    dasan.push({
      age: `${age}-${age + 9}`,
      palace: ZW_PALACES[palaceIdx],
      branch: BRANCHES[palaceIdx],
      wuxing: BRANCH_WUXING[BRANCHES[palaceIdx]]
    });
  }
  return dasan;
}

// 综合紫微斗数报告
function calcZiweiV2(yearStem, yearBranch, monthBranch, dayStem, dayBranch, hourBranch, gender) {
  const yearIdx = BRANCHES.indexOf(yearBranch);
  const monthIdx = BRANCHES.indexOf(monthBranch);
  const hourIdx = BRANCHES.indexOf(hourBranch);
  const dayIdx = BRANCHES.indexOf(dayBranch);

  // 1. diao值（紫微星所在）
  const diao = getDiao(dayStem, dayBranch);

  // 2. 命宫（从日支起）
  const mingGong = getMingGong(dayBranch);

  // 3. 身宫（命宫 + 月支 + 时支，顺数）
  const shenGong = getShenGong(mingGong, monthBranch, hourBranch);

  // 4. 纳音五行局
  const najiaKey = yearStem + yearBranch;
  const wuxingJu = NAJIA_TABLE[najiaKey] || '木';

  // 5. 十四主星分布
  const starPositions = place14Stars(diao);

  // 6. 四化星
  const sihua = placeSiHua(yearStem, starPositions);

  // 7. 六吉星
  const luckyStars = placeLuckyStars(yearStem, monthBranch, hourBranch);

  // 8. 六煞星
  const fierceStars = placeFierceStars(yearStem, yearBranch, hourBranch);

  // 9. 禄存天马
  const auxStars = placeAuxStars(yearStem, yearBranch);

  // 10. 天姚红鸾
  const yaoluan = placeYaoLuan(yearBranch);

  // 11. 合并所有星曜到十二宫
  const palacesData = {};
  for (let i = 0; i < 12; i++) {
    palacesData[ZW_PALACES[i]] = {
      branch: BRANCHES[i],
      mainStars: [],
      luckyStars: [],
      fierceStars: [],
      auxStars: [],
      hua: []
    };
  }

  // 主星入宫
  for (const [star, pos] of Object.entries(starPositions)) {
    palacesData[ZW_PALACES[pos]].mainStars.push(star);
  }
  // 吉星入宫
  for (const [star, pos] of Object.entries(luckyStars)) {
    palacesData[ZW_PALACES[pos]].luckyStars.push(star);
  }
  // 煞星入宫
  for (const [star, pos] of Object.entries(fierceStars)) {
    palacesData[ZW_PALACES[pos]].fierceStars.push(star);
  }
  // 禄存天马入宫
  for (const [star, pos] of Object.entries(auxStars)) {
    palacesData[ZW_PALACES[pos]].auxStars.push(star);
  }
  // 天姚红鸾入宫
  for (const [star, pos] of Object.entries(yaoluan)) {
    palacesData[ZW_PALACES[pos]].auxStars.push(star);
  }
  // 四化标记
  for (const [star, info] of Object.entries(sihua)) {
    palacesData[info.palace].hua.push(`${star}化${info.type}`);
  }

  // 12. 亮度
  for (const palace of Object.keys(palacesData)) {
    const branchIdx = BRANCHES.indexOf(palacesData[palace].branch);
    palacesData[palace].mainStars.forEach(star => {
      palacesData[palace][star] = getStarBrightness(star, branchIdx);
    });
  }

  // 13. 命宫解读
  const mingStars = palacesData[ZW_PALACES[mingGong]].mainStars;
  const mingInterpret = mingStars.length > 0
    ? `命宫坐${mingStars.join('、')}。${mingStars.map(s => ZW_STAR_MEANING[s] || '').join('；')}`
    : '命宫无主星，借对宫迁移宫之星曜参考。';

  // 14. 身宫解读
  const shenStars = palacesData[ZW_PALACES[shenGong]].mainStars;
  const shenInterpret = shenStars.length > 0
    ? `身宫落${ZW_PALACES[shenGong]}，有${shenStars.join('、')}坐守。`
    : `身宫落${ZW_PALACES[shenGong]}，无主星。`;

  // 15. 关键宫位分析
  const keyPalaces = ['命宫', '财帛', '官禄', '夫妻', '迁移', '福德'];
  const keyAnalysis = {};
  for (const p of keyPalaces) {
    const d = palacesData[p];
    let text = '';
    if (d.mainStars.length > 0) {
      text += `主星：${d.mainStars.join('、')} `;
      const bri = d.mainStars.map(s => `${s}(${d[s] || '平'})`).join(' ');
      text += `[${bri}]`;
    } else {
      text += '无主星';
    }
    if (d.luckyStars.length > 0) text += `；吉星：${d.luckyStars.join('、')}`;
    if (d.fierceStars.length > 0) text += `；煞星：${d.fierceStars.join('、')}`;
    if (d.auxStars.length > 0) text += `；辅星：${d.auxStars.join('、')}`;
    if (d.hua.length > 0) text += `；四化：${d.hua.join('、')}`;
    keyAnalysis[p] = text;
  }

  // 16. 大限
  const dasan = calcDaYun_ziwei(mingGong, 2000);

  return {
    diao,
    wuxingJu,
    mingGong: { palace: ZW_PALACES[mingGong], branch: BRANCHES[mingGong] },
    shenGong: { palace: ZW_PALACES[shenGong], branch: BRANCHES[shenGong] },
    ziweiPalace: ZW_PALACES[diao],
    starPositions,
    palacesData,
    keyAnalysis,
    siHua: sihua,
    dasan,
    mingInterpret,
    shenInterpret,
    currentDasan: dasan[1] || dasan[0],
    note: `紫微星${diao === 0 ? '在丑宫' : diao === 6 ? '在未宫' : '在' + BRANCHES[diao] + '宫'}，一六分隔法定宫`
  };
}

// ============================================================
// 第八部分：道医体质分析
// ============================================================

function calcDaoYiTiZhi(dayStem, dayZhi, monthBranch, wuxingCount, strength) {
  const dayWx = STEM_WUXING[dayStem];
  const monthWx = BRANCH_WUXING[monthBranch];

  const winterBranches = ['亥', '子', '丑'];
  const summerBranches = ['巳', '午', '未'];

  const fireCount = wuxingCount['火'] || 0;
  const waterCount = wuxingCount['水'] || 0;
  const woodCount = wuxingCount['木'] || 0;
  const earthCount = wuxingCount['土'] || 0;
  const metalCount = wuxingCount['金'] || 0;

  let primaryType = '';
  let primaryDesc = '';
  let primarySymptoms = [];
  let dietAdvice = '';
  let acupoints = [];
  let dailyAdvice = '';
  let herbalDirection = '';

  // 寒湿体质
  if (winterBranches.includes(monthBranch) && waterCount >= 3 && fireCount <= 1) {
    primaryType = '寒湿体质（寒湿困脾）';
    primaryDesc = `生于寒冬${monthBranch}月，水性泛滥而火气衰微。寒水过盛，阳气不足。`;
    primarySymptoms = [
      '畏寒怕冷，四肢不温，冬季尤甚',
      '面色苍白或晦暗，舌淡胖有齿痕',
      '大便溏薄或黏腻不爽，小便清长',
      '精神不振，容易疲劳嗜睡'
    ];
    dietAdvice = '宜温补：生姜、肉桂、花椒、羊肉、韭菜、核桃、红枣。忌生冷、冰饮。';
    acupoints = ['关元(CV4)', '命门(GV4)', '足三里(ST36)', '神阙(CV8)'];
    dailyAdvice = '每日上午10点前晒太阳30分钟；艾灸关元、命门；睡前热水泡脚至微汗';
    herbalDirection = '温阳散寒，健脾化湿。参考：理中汤、附子理中丸加减';
  }
  // 燥热体质
  else if (summerBranches.includes(monthBranch) && fireCount >= 3 && waterCount <= 1) {
    primaryType = '燥热体质（火热内盛）';
    primaryDesc = `生于炎夏${monthBranch}月，火旺水枯，燥气横行。`;
    primarySymptoms = [
      '口干舌燥，咽喉肿痛，口舌生疮',
      '面红目赤，易长痘痘痤疮',
      '心烦易怒，失眠多梦，手心发热',
      '大便干结，小便黄赤短少'
    ];
    dietAdvice = '宜清润：绿豆、莲子、百合、银耳、梨、西瓜、苦瓜、菊花茶。忌辛辣、烧烤。';
    acupoints = ['太溪(KI3)', '三阴交(SP6)', '涌泉(KI1)', '曲池(LI11)'];
    dailyAdvice = '避免午后暴晒；多饮温水；练习静坐冥想；子时前入睡养阴';
    herbalDirection = '清热润燥，养阴生津。参考：白虎汤、竹叶石膏汤加减';
  }
  // 虚火体质
  else if (strength.includes('弱') && fireCount <= 1 && waterCount <= 1) {
    primaryType = '虚火体质（阴虚火旺）';
    primaryDesc = `日主${dayStem}${dayWx}本弱，水不制火而虚火上浮。`;
    primarySymptoms = [
      '潮热盗汗，午后或夜间发热',
      '五心烦热（手心、脚心、胸口发热）',
      '口干不欲饮，咽干鼻燥',
      '腰膝酸软，头晕耳鸣'
    ];
    dietAdvice = '宜滋阴降火：枸杞、桑葚、黑芝麻、山药、鸭肉、甲鱼、银耳。';
    acupoints = ['太溪(KI3)', '照海(KI6)', '三阴交(SP6)', '涌泉(KI1)'];
    dailyAdvice = '避免熬夜（最忌23点后睡）；节制房事；晨起叩齿吞津';
    herbalDirection = '滋阴降火，交通心肾。参考：知柏地黄丸、天王补心丹加减';
  }
  // 气虚体质
  else if (strength.includes('弱') && earthCount >= 2 && metalCount <= 1) {
    primaryType = '气虚体质（脾肺气虚）';
    primaryDesc = `日主${dayStem}${dayWx}偏弱，土尚可但金不足，母弱子虚。`;
    primarySymptoms = [
      '气短懒言，语声低微，稍动即喘',
      '面色萎黄，容易出汗',
      '食欲不振，饭后腹胀',
      '容易感冒，抵抗力差'
    ];
    dietAdvice = '宜补气健脾：黄芪、党参、山药、红枣、小米、鸡肉、牛肉。';
    acupoints = ['气海(CV6)', '足三里(ST36)', '百会(GV20)', '脾俞(BL20)'];
    dailyAdvice = '规律作息，午时小憩15-30分钟；适度散步，不可过劳';
    herbalDirection = '补中益气，健脾补肺。参考：补中益气汤、四君子汤加减';
  }
  // 痰湿体质
  else if (earthCount >= 3 && waterCount >= 2) {
    primaryType = '痰湿体质（脾虚湿盛）';
    primaryDesc = `命局土湿过重，脾运不健，水湿内停，化为痰饮。`;
    primarySymptoms = [
      '体型偏胖，腹部松软肥满',
      '面部油脂分泌旺盛，容易出油',
      '痰多胸闷，口中黏腻不爽',
      '身体沉重，容易困倦嗜睡'
    ];
    dietAdvice = '宜健脾化湿：薏米、赤小豆、冬瓜、茯苓、陈皮、白扁豆。忌油腻、甜腻。';
    acupoints = ['丰隆(ST40)', '阴陵泉(SP9)', '中脘(CV12)', '天枢(ST25)'];
    dailyAdvice = '每天快走40分钟以上至微汗；避免久坐；少食多餐';
    herbalDirection = '健脾祛湿，化痰降浊。参考：二陈汤、平胃散、参苓白术散加减';
  }
  // 气郁体质
  else if (woodCount >= 3 && metalCount <= 1) {
    primaryType = '气郁体质（肝郁气滞）';
    primaryDesc = `命局木气过旺而无金制衡，犹如林木疯长，气机郁结不畅。`;
    primarySymptoms = [
      '情绪低落，多愁善感，容易焦虑',
      '胸闷胁痛，善太息（叹气）',
      '咽喉有异物感（梅核气）',
      '失眠多梦，早醒难再眠'
    ];
    dietAdvice = '宜疏肝理气：玫瑰花、佛手、香橼、薄荷、柑橘。忌辛辣刺激。';
    acupoints = ['太冲(LR3)', '期门(LR14)', '膻中(CV17)', '合谷(LI4)'];
    dailyAdvice = '每日户外活动1小时；练习深呼吸；养花草怡情；遇事找人倾诉';
    herbalDirection = '疏肝解郁，理气和中。参考：逍遥散、柴胡疏肝散加减';
  }
  // 平和体质
  else {
    primaryType = '平和体质（阴阳平衡）';
    primaryDesc = `命局五行较为均衡，日主${dayStem}${dayWx}得令得地，阴阳调和。`;
    primarySymptoms = [
      '面色红润有光泽，精力充沛',
      '睡眠质量好，一觉到天亮',
      '大便规律成形，小便正常',
      '情绪稳定，适应力强'
    ];
    dietAdvice = '均衡饮食即可，根据季节微调。春养肝、夏养心、秋养肺、冬养肾。';
    acupoints = ['足三里(ST36)', '关元(CV4)', '涌泉(KI1)', '百会(GV20)'];
    dailyAdvice = '保持良好作息，适度运动，心态平和。';
    herbalDirection = '日常可服用四君子汤或八珍汤保健。';
  }

  const zangFuMap = {
    '甲': { zang: '肝', fu: '胆' }, '乙': { zang: '肝', fu: '胆' },
    '丙': { zang: '心', fu: '小肠' }, '丁': { zang: '心', fu: '小肠' },
    '戊': { zang: '脾', fu: '胃' }, '己': { zang: '脾', fu: '胃' },
    '庚': { zang: '肺', fu: '大肠' }, '辛': { zang: '肺', fu: '大肠' },
    '壬': { zang: '肾', fu: '膀胱' }, '癸': { zang: '肾', fu: '膀胱' }
  };
  const zf = zangFuMap[dayStem] || { zang: '脾', fu: '胃' };

  return {
    primaryType, primaryDesc, primarySymptoms,
    dietAdvice, acupoints, dailyAdvice, herbalDirection,
    weakOrgan: zf.zang, weakFu: zf.fu,
    organAdvice: `日主${dayStem}应重点养护${zf.zang}${zf.fu}系统。`,
    wuxingBias: { fireCount, waterCount, woodCount, earthCount, metalCount }
  };
}

// ============================================================
// 第九部分：五运六气（黄帝内经）
// ============================================================

const YUN_TABLE = {
  '甲': { yun: '土运', type: '太过' }, '己': { yun: '土运', type: '不及' },
  '乙': { yun: '金运', type: '不及' }, '庚': { yun: '金运', type: '太过' },
  '丙': { yun: '水运', type: '太过' }, '辛': { yun: '水运', type: '不及' },
  '丁': { yun: '木运', type: '不及' }, '壬': { yun: '木运', type: '太过' },
  '戊': { yun: '火运', type: '太过' }, '癸': { yun: '火运', type: '不及' }
};

const LIUQI_SIZAI = {
  '子': { siTian: '少阴君火', zaiQuan: '阳明燥金' }, '午': { siTian: '少阴君火', zaiQuan: '阳明燥金' },
  '丑': { siTian: '太阴湿土', zaiQuan: '太阳寒水' }, '未': { siTian: '太阴湿土', zaiQuan: '太阳寒水' },
  '寅': { siTian: '少阳相火', zaiQuan: '厥阴风木' }, '申': { siTian: '少阳相火', zaiQuan: '厥阴风木' },
  '卯': { siTian: '阳明燥金', zaiQuan: '少阴君火' }, '酉': { siTian: '阳明燥金', zaiQuan: '少阴君火' },
  '辰': { siTian: '太阳寒水', zaiQuan: '太阴湿土' }, '戌': { siTian: '太阳寒水', zaiQuan: '太阴湿土' },
  '巳': { siTian: '厥阴风木', zaiQuan: '少阳相火' }, '亥': { siTian: '厥阴风木', zaiQuan: '少阳相火' }
};

const LIUQI_ZANGFU = {
  '厥阴风木': { zang: '肝', fu: '胆', desc: '风气通肝，易致肝气郁结、头目眩晕、筋脉拘挛' },
  '少阴君火': { zang: '心', fu: '小肠', desc: '热气通心，易致心烦失眠、口舌生疮、心悸怔忡' },
  '少阳相火': { zang: '心包', fu: '三焦', desc: '相火妄动，易致内热烦躁、疮疡肿毒、发热不退' },
  '太阴湿土': { zang: '脾', fu: '胃', desc: '湿气通脾，易致腹胀泄泻、身体困重、痰饮水肿' },
  '阳明燥金': { zang: '肺', fu: '大肠', desc: '燥气通肺，易致咳嗽咽干、皮肤干燥、大便干结' },
  '太阳寒水': { zang: '肾', fu: '膀胱', desc: '寒气通肾，易致畏寒肢冷、腰膝冷痛、小便不利' }
};

function calcWuYunLiuQi(yearStem, yearBranch, dayStem, daoyi) {
  const yunInfo = YUN_TABLE[yearStem];
  const qiInfo = LIUQI_SIZAI[yearBranch];
  const siTian = qiInfo.siTian;
  const zaiQuan = qiInfo.zaiQuan;

  const yunWuxing = yunInfo.yun.replace('运', '');
  const siTianWx = { '木': '木', '火': '火', '土': '土', '金': '金', '水': '水' }[siTian.replace('少阴君火', '火').replace('少阳相火', '火').replace('太阴湿土', '土').replace('阳明燥金', '金').replace('厥阴风木', '木').replace('太阳寒水', '水')] || '土';

  const dayWx = STEM_WUXING[dayStem];
  let personalImpact = [];

  const generates = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
  const overcomes = { '木': '金', '金': '火', '火': '水', '水': '土', '土': '木' };

  if (generates[yunWuxing] === dayWx) {
    personalImpact.push(`岁运${yunInfo.yun}生您日主${dayWx}，本年天地之气对您有生助之益，运势上升。`);
  } else if (dayWx === generates[yunWuxing]) {
    personalImpact.push(`您日主${dayWx}生岁运${yunInfo.yun}，本年付出较多精力，宜守不宜攻。`);
  } else if (dayWx === yunWuxing) {
    personalImpact.push(`岁运${yunInfo.yun}与您日主同属${dayWx}，本年比肩相助，贵人运旺。`);
  } else if (overcomes[yunWuxing] === dayWx) {
    personalImpact.push(`⚠️ 岁运${yunInfo.yun}克您日主${dayWx}，本年需特别注意健康，做事谨慎。`);
  }

  return {
    yearYun: yunInfo.yun,
    yearYunType: yunInfo.type,
    siTian,
    zaiQuan,
    personalImpact,
    healthAdvice: `本年司天${siTian}，重点养护${LIUQI_ZANGFU[siTian]?.zang}${LIUQI_ZANGFU[siTian]?.fu}。${LIUQI_ZANGFU[siTian]?.desc || ''}。`,
    summary: `${yunInfo.yun}${yunInfo.type}之年，司天${siTian}，在泉${zaiQuan}。`
  };
}

// ============================================================
// 第十部分：面相 + 手相 + 风水
// ============================================================

function calcMianXiang(dayStem) {
  const wx = STEM_WUXING[dayStem];
  const shapes = {
    '金': { shape: '国字脸或方脸，轮廓分明', nose: '鼻梁挺直，鼻头有肉，主财运稳固', career: '宜金融、法律、管理类' },
    '木': { shape: '长脸或瓜子脸，清秀挺拔', nose: '鼻梁较高，山根有力，主中年运好', career: '宜教育、文化、艺术类' },
    '水': { shape: '圆脸或鹅蛋脸，线条柔和', nose: '鼻头圆润，鼻翼饱满，主财运亨通', career: '宜商贸、传媒、服务类' },
    '火': { shape: '倒三角脸或菱形脸，棱角分明', nose: '鼻梁高挺，鼻尖较尖，主果断', career: '宜演艺、餐饮、能源类' },
    '土': { shape: '方圆形脸，敦厚稳重', nose: '鼻子端正，鼻头厚重，主财运丰隆', career: '宜地产、建筑、农业类' }
  };
  const s = shapes[wx] || shapes['土'];
  return {
    faceShape: s.shape,
    nose: s.nose,
    career: s.career,
    overall: `五行属${wx}，面形${s.shape}。`
  };
}

function calcShouXiang(dayStem) {
  const wx = STEM_WUXING[dayStem];
  const palms = {
    '金': { palm: '方形手掌，掌肉厚实', lifeLine: '生命线清晰深长，主健康良好' },
    '木': { palm: '长形手掌，手指修长', lifeLine: '生命线细长延伸，主寿命绵长' },
    '水': { palm: '圆形手掌，手指饱满', lifeLine: '生命线圆润流长，主体质柔韧' },
    '火': { palm: '锥形手掌，指尖尖锐', lifeLine: '生命线粗壮有力，主体质强健' },
    '土': { palm: '方形厚掌，手掌宽大', lifeLine: '生命线粗壮深长，主体质强健' }
  };
  const p = palms[wx] || palms['土'];
  return {
    palmType: p.palm,
    lifeLine: p.lifeLine,
    summary: `五行属${wx}，${p.palm}。`
  };
}

// ============================================================
// API 入口
// ============================================================

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

    // 四柱计算
    const [yearGan, yearZhi] = calcYearPillar(year);
    const [monthGan, monthZhi] = calcMonthPillar(yearGan, month, day);
    const [dayGan, dayZhi] = calcDayPillar(year, month, day);
    const [hourGan, hourZhi] = calcHourPillar(dayGan, hourName);

    const pillars = [[yearGan, yearZhi], [monthGan, monthZhi], [dayGan, dayZhi], [hourGan, hourZhi]];

    // 五行分布
    const wuxingCount = calcWuxingDistribution(pillars);

    // 日主强弱
    const strength = analyzeDayStrength(dayGan, monthZhi, wuxingCount);

    // 格局认定
    const geJu = recognizeGeJu(pillars, dayGan, dayZhi);

    // 调候
    const tiaoHou = calcTiaoHou(monthZhi, dayGan, wuxingCount);

    // 用神
    const yongShen = calcYongShen(dayGan, strength, geJu, tiaoHou, wuxingCount);

    // 性格
    const personality = analyzePersonality(dayGan, strength, geJu);

    // 幸运指南
    const luckyGuide = calcLuckyGuide(yongShen);

    // 流年
    const now = new Date();
    const currentYear = now.getFullYear();
    const [cyGan, cyZhi] = calcYearPillar(currentYear);
    const liuNian = analyzeLiuNian(cyGan, cyZhi, pillars, yongShen, dayGan);

    // 十神
    const shiShen = {};
    ['year', 'month', 'day', 'hour'].forEach((k, i) => {
      const [ss, desc] = getShiShen(dayGan, pillars[i][0]);
      shiShen[k] = { name: ss, desc };
    });

    // 紫微斗数V2
    const ziwei = calcZiweiV2(yearGan, yearZhi, monthZhi, dayGan, dayZhi, hourZhi, gender);

    // 道医体质
    const daoyi = calcDaoYiTiZhi(dayGan, dayZhi, monthZhi, wuxingCount, strength);

    // 五运六气
    const wuyunliuqi = calcWuYunLiuQi(yearGan, yearZhi, dayGan, daoyi);

    // 面相手相
    const mianxiang = calcMianXiang(dayGan);
    const shouxiang = calcShouXiang(dayGan);

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
      // 核心改进
      geJu: {
        name: geJu.geJuName,
        type: geJu.geJuType,
        principal: geJu.principal,
        喜忌: geJu.xiJi,
        guanShaStatus: geJu.guanShaStatus
      },
      tiaoHou: {
        need: tiaoHou.tiaoHou,
        desc: tiaoHou.tiaoHouDesc
      },
      yongShen: {
        shen: yongShen.yongShen,
        avoid: yongShen.avoid,
        principle: yongShen.principle
      },
      dayMaster: dayGan,
      dayWuxing: STEM_WUXING[dayGan],
      wuxingCount,
      strength,
      personality,
      luckyGuide,
      shiShen,
      liuNian,
      ziwei,
      daoyi,
      wuyunliuqi,
      mianxiang,
      shouxiang
    };

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}