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
    shiShen
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
