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

// ============================================================
// 道医体质分析
// ============================================================
function calcDaoYiTiZhi(dayStem, dayZhi, monthBranch, wuxingCount, strength) {
  const dayWx = STEM_WUXING[dayStem];
  const monthWx = BRANCH_WUXING[monthBranch];
  const dayZhiWx = BRANCH_WUXING[dayZhi];

  // 季节寒热
  const spring = ['寅','卯','辰'];
  const summer = ['巳','午','未'];
  const autumn = ['申','酉','戌'];
  const winter = ['亥','子','丑'];

  let season = '平';
  let seasonNature = '';
  if (spring.includes(monthBranch)) { season = '春'; seasonNature = '温升'; }
  else if (summer.includes(monthBranch)) { season = '夏'; seasonNature = '炎热'; }
  else if (autumn.includes(monthBranch)) { season = '秋'; seasonNature = '燥凉'; }
  else { season = '冬'; seasonNature = '寒冷'; }

  // 五行偏性计算
  const fireMetal = (wuxingCount['火']||0) + (wuxingCount['金']||0);
  const waterEarth = (wuxingCount['水']||0) + (wuxingCount['土']||0);
  const woodCount = wuxingCount['木']||0;
  const fireCount = wuxingCount['火']||0;
  const waterCount = wuxingCount['水']||0;
  const earthCount = wuxingCount['土']||0;
  const metalCount = wuxingCount['金']||0;

  // 脏腑对应
  const zangFu = {
    '甲': { zang: '肝', fu: '胆', meridian: '足厥阴肝经/足少阳胆经' },
    '乙': { zang: '肝', fu: '胆', meridian: '足厥阴肝经' },
    '丙': { zang: '心', fu: '小肠', meridian: '手少阴心经/手太阳小肠经' },
    '丁': { zang: '心', fu: '小肠', meridian: '手少阴心经' },
    '戊': { zang: '脾', fu: '胃', meridian: '足太阴脾经/足阳明胃经' },
    '己': { zang: '脾', fu: '胃', meridian: '足太阴脾经' },
    '庚': { zang: '肺', fu: '大肠', meridian: '手太阴肺经/手阳明大肠经' },
    '辛': { zang: '肺', fu: '大肠', meridian: '手太阴肺经' },
    '壬': { zang: '肾', fu: '膀胱', meridian: '足少阴肾经/足太阳膀胱经' },
    '癸': { zang: '肾', fu: '膀胱', meridian: '足少阴肾经' },
  };

  const zf = zangFu[dayStem];

  // 体质判定（主类型 + 兼夹类型）
  let primaryType = '';
  let primaryDesc = '';
  let primarySymptoms = [];
  let secondaryTypes = [];
  let dietAdvice = '';
  let acupoints = [];
  let dailyAdvice = '';
  let herbalDirection = '';

  // 寒湿体质：冬生 + 水多 + 火弱
  if (season === '冬' && waterCount >= 3 && fireCount <= 1) {
    primaryType = '寒湿体质（寒湿困脾）';
    primaryDesc = `生于寒冬${monthBranch}月，水性泛滥而火气衰微。寒水过盛，阳气不足，犹如冰封大地。`;
    primarySymptoms = [
      '畏寒怕冷，四肢不温，冬季尤甚',
      '面色苍白或晦暗，舌淡胖有齿痕',
      '大便溏薄或黏腻不爽，小便清长',
      '精神不振，容易疲劳嗜睡',
      '关节冷痛，遇寒加重，得温则减',
      '女性多见痛经、白带清稀量多'
    ];
    dietAdvice = '宜温补：生姜、肉桂、花椒、羊肉、韭菜、核桃、红枣。忌生冷、冰饮、西瓜、苦瓜。';
    acupoints = ['关元(CV4)', '命门(GV4)', '足三里(ST36)', '神阙(CV8)', '气海(CV6)'];
    dailyAdvice = '每日上午10点前晒太阳30分钟；艾灸关元、命门；睡前热水泡脚至微汗';
    herbalDirection = '温阳散寒，健脾化湿。参考：理中汤、附子理中丸、苓桂术甘汤加减';
    if (waterCount >= 4) secondaryTypes.push('阳虚体质');
    if (earthCount >= 3) secondaryTypes.push('痰湿体质');
  }
  // 燥热体质：夏生 + 火多 + 水弱
  else if (season === '夏' && fireCount >= 3 && waterCount <= 1) {
    primaryType = '燥热体质（火热内盛）';
    primaryDesc = `生于炎夏${monthBranch}月，火旺水枯，燥气横行。犹如烈日炙烤大地，津液易亏。`;
    primarySymptoms = [
      '口干舌燥，咽喉肿痛，口舌生疮',
      '面红目赤，易长痘痘痤疮',
      '心烦易怒，失眠多梦，手心发热',
      '大便干结，小便黄赤短少',
      '皮肤干燥瘙痒，易过敏',
      '容易上火、牙龈肿痛、鼻血'
    ];
    dietAdvice = '宜清润：绿豆、莲子、百合、银耳、梨、西瓜、苦瓜、菊花茶。忌辛辣、烧烤、羊肉、酒。';
    acupoints = ['太溪(KI3)', '三阴交(SP6)', '涌泉(KI1)', '曲池(LI11)', '内庭(ST44)'];
    dailyAdvice = '避免午后暴晒；多饮温水；练习静坐冥想以降心火；子时前入睡养阴';
    herbalDirection = '清热润燥，养阴生津。参考：白虎汤、竹叶石膏汤、沙参麦冬汤加减';
    if (metalCount >= 3) secondaryTypes.push('阴虚体质');
    if (woodCount >= 2) secondaryTypes.push('气郁体质');
  }
  // 虚火体质：身弱 + 火不足 + 水也不足（阴虚火旺）
  else if (strength.includes('弱') && fireCount <= 1 && waterCount <= 1) {
    primaryType = '虚火体质（阴虚火旺）';
    primaryDesc = `日主${dayStem}${dayWx}本弱，水不制火而虚火上浮。犹如油灯将尽，火焰飘摇不定。`;
    primarySymptoms = [
      '潮热盗汗，午后或夜间发热',
      '五心烦热（手心、脚心、胸口发热）',
      '口干不欲饮，咽干鼻燥',
      '失眠多梦，心悸怔忡',
      '腰膝酸软，头晕耳鸣',
      '舌红少苔，脉细数'
    ];
    dietAdvice = '宜滋阴降火：枸杞、桑葚、黑芝麻、山药、鸭肉、甲鱼、银耳。忌温燥补品。';
    acupoints = ['太溪(KI3)', '照海(KI6)', '三阴交(SP6)', '涌泉(KI1)', '复溜(KI7)'];
    dailyAdvice = '避免熬夜（最忌23点后睡）；节制房事；晨起叩齿吞津；太极拳或八段锦';
    herbalDirection = '滋阴降火，交通心肾。参考：知柏地黄丸、天王补心丹、黄连阿胶汤加减';
    secondaryTypes.push('阴虚体质');
  }
  // 气虚体质：身弱 + 土不生金
  else if (strength.includes('弱') && earthCount >= 2 && metalCount <= 1) {
    primaryType = '气虚体质（脾肺气虚）';
    primaryDesc = `日主${dayStem}${dayWx}偏弱，土（脾胃）尚可但金（肺气）不足，母弱子虚。`;
    primarySymptoms = [
      '气短懒言，语声低微，稍动即喘',
      '面色萎黄或㿠白，容易出汗',
      '食欲不振，饭后腹胀',
      '容易感冒，抵抗力差',
      '四肢乏力，精神萎靡',
      '舌淡苔白，脉弱无力'
    ];
    dietAdvice = '宜补气健脾：黄芪、党参、山药、红枣、小米、鸡肉、牛肉。忌耗气之品。';
    acupoints = ['气海(CV6)', '足三里(ST36)', '百会(GV20)', '脾俞(BL20)', '肺俞(BL13)'];
    dailyAdvice = '规律作息，午时小憩15-30分钟；适度散步，不可过劳；少言养气';
    herbalDirection = '补中益气，健脾补肺。参考：补中益气汤、四君子汤、玉屏风散加减';
    if (waterCount <= 1) secondaryTypes.push('阳虚体质');
  }
  // 痰湿体质：土多 + 水多
  else if (earthCount >= 3 && waterCount >= 2) {
    primaryType = '痰湿体质（脾虚湿盛）';
    primaryDesc = `命局土湿过重，脾运不健，水湿内停，化为痰饮。犹如沼泽泥泞，气机不畅。`;
    primarySymptoms = [
      '体型偏胖，腹部松软肥满',
      '面部油脂分泌旺盛，容易出油',
      '痰多胸闷，口中黏腻不爽',
      '大便黏滞不成形，小便浑浊',
      '身体沉重，容易困倦嗜睡',
      '舌体胖大，舌苔厚腻，脉滑'
    ];
    dietAdvice = '宜健脾化湿：薏米、赤小豆、冬瓜、茯苓、陈皮、白扁豆。忌油腻、甜腻、奶制品。';
    acupoints = ['丰隆(ST40)', '阴陵泉(SP9)', '中脘(CV12)', '天枢(ST25)', '足三里(ST36)'];
    dailyAdvice = '每天快走40分钟以上至微汗；避免久坐；少食多餐；常喝陈皮薏米茶';
    herbalDirection = '健脾祛湿，化痰降浊。参考：二陈汤、平胃散、参苓白术散加减';
    if (fireCount <= 1) secondaryTypes.push('阳虚体质');
  }
  // 气郁体质：木多 + 金弱
  else if (woodCount >= 3 && metalCount <= 1) {
    primaryType = '气郁体质（肝郁气滞）';
    primaryDesc = `命局木气过旺而无金制衡，犹如林木疯长而无修剪，气机郁结不畅。`;
    primarySymptoms = [
      '情绪低落，多愁善感，容易焦虑',
      '胸闷胁痛，善太息（叹气）',
      '咽喉有异物感（梅核气）',
      '失眠多梦，早醒难再眠',
      '女性经前乳房胀痛、月经不调',
      '舌淡红苔薄白，脉弦'
    ];
    dietAdvice = '宜疏肝理气：玫瑰花、佛手、香橼、薄荷、柑橘、芹菜、茼蒿。忌辛辣刺激。';
    acupoints = ['太冲(LR3)', '期门(LR14)', '膻中(CV17)', '合谷(LI4)', '阳陵泉(GB34)'];
    dailyAdvice = '每日户外活动1小时；练习深呼吸（4-7-8呼吸法）；养花草怡情；遇事找人倾诉';
    herbalDirection = '疏肝解郁，理气和中。参考：逍遥散、柴胡疏肝散、越鞠丸加减';
    if (fireCount >= 2) secondaryTypes.push('燥热体质');
  }
  // 血瘀体质：金弱 + 火多（热灼血瘀）或 寒重（寒凝血瘀）
  else if ((fireCount >= 3 && metalCount <= 1) || (season === '冬' && waterCount >= 3)) {
    primaryType = (fireCount >= 3) ? '血瘀体质（热灼血瘀）' : '血瘀体质（寒凝血瘀）';
    primaryDesc = (fireCount >= 3)
      ? `火旺灼血，血液黏稠运行不畅，犹如浓汤难流。`
      : `寒性收引，血脉凝滞不畅，犹如冰封河道。`;
    primarySymptoms = [
      '面色晦暗或色素沉着，容易出现瘀斑',
      '口唇颜色偏暗偏紫',
      '身体某处固定刺痛，夜间加重',
      '女性痛经有血块，经色紫暗',
      '皮肤干燥粗糙如鱼鳞',
      '舌质紫暗或有瘀斑瘀点，舌下静脉曲张'
    ];
    dietAdvice = '宜活血化瘀：山楂、醋、黑豆、茄子、红糖姜茶、三七花。忌寒凉凝固之品（寒瘀者）、忌辛辣煎炸（热瘀者）。';
    acupoints = ['血海(SP10)', '膈俞(BL17)', '三阴交(SP6)', '合谷(LI4)', '太冲(LR3)'];
    dailyAdvice = '每日适度运动至微汗，促进血液流通；保持心情愉快；温水泡脚通经活络';
    herbalDirection = '活血化瘀，通络止痛。参考：血府逐瘀汤、桃红四物汤、丹参饮加减';
    secondaryTypes.push(strength.includes('弱') ? '气虚体质' : '气郁体质');
  }
  // 平和体质（接近平衡）
  else {
    primaryType = '平和体质（阴阳平衡）';
    primaryDesc = `命局五行较为均衡，日主${dayStem}${dayWx}得令得地，阴阳调和，是为吉相。但仍需注意季节保养。`;
    primarySymptoms = [
      '面色红润有光泽，精力充沛',
      '睡眠质量好，一觉到天亮',
      '大便规律成形，小便正常',
      '情绪稳定，适应力强',
      '舌淡红苔薄白，脉和缓有力'
    ];
    dietAdvice = '均衡饮食即可，根据季节微调。春养肝、夏养心、秋养肺、冬养肾。';
    acupoints = ['足三里(ST36)', '关元(CV4)', '涌泉(KI1)', '百会(GV20)'];
    dailyAdvice = '保持良好作息，适度运动，心态平和。';
    herbalDirection = '无特别偏性，日常可服用四君子汤或八珍汤保健。';
  }

  // 脏腑易病倾向
  const weakOrgan = zf.zang;
  const weakFu = zf.fu;
  const organAdvice = `日主${dayStem}应重点养护${weakOrgan}${weakFu}系统。注意${weakOrgan === '肝' ? '少怒、忌酒、勿熬夜（23点为肝经当令）' : weakOrgan === '心' ? '保持心情平和、午时小憩（11-13点为心经当令）' : weakOrgan === '脾' ? '饮食规律、忌暴饮暴食（9-11点为脾经当令）' : weakOrgan === '肺' ? '防感冒、晨起深呼吸（3-5点为肺经当令）' : '不憋尿、多饮水（17-19点为肾经当令）'}。`;

  return {
    primaryType,
    primaryDesc,
    primarySymptoms,
    secondaryTypes,
    dietAdvice,
    acupoints,
    dailyAdvice,
    herbalDirection,
    season,
    seasonNature,
    weakOrgan,
    weakFu,
    organAdvice,
    wuxingBias: { fireCount, waterCount, woodCount, earthCount, metalCount }
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

// 紫微主星（14颗）
const ZW_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

// 六吉星
const ZW_LUCKY_STARS = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺'];
// 六煞星
const ZW_FIERCE_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
// 其他辅星
const ZW_AUX_STARS = ['禄存', '天马'];

// 年干四化表
const SIHUA_TABLE = {
  '甲': { lu:'廉贞', quan:'破军', ke:'武曲', ji:'太阳' },
  '乙': { lu:'天机', quan:'天梁', ke:'紫微', ji:'太阴' },
  '丙': { lu:'天同', quan:'天机', ke:'文昌', ji:'廉贞' },
  '丁': { lu:'太阴', quan:'天同', ke:'天机', ji:'巨门' },
  '戊': { lu:'贪狼', quan:'太阴', ke:'右弼', ji:'天机' },
  '己': { lu:'武曲', quan:'贪狼', ke:'天梁', ji:'文曲' },
  '庚': { lu:'太阳', quan:'武曲', ke:'太阴', ji:'天同' },
  '辛': { lu:'巨门', quan:'太阳', ke:'文曲', ji:'文昌' },
  '壬': { lu:'天梁', quan:'紫微', ke:'左辅', ji:'武曲' },
  '癸': { lu:'破军', quan:'巨门', ke:'太阴', ji:'贪狼' },
};

// 天魁天钺表（年干）
const KUIYUE_TABLE = {
  '甲': { kui:'丑', yue:'未' }, '戊': { kui:'丑', yue:'未' }, '庚': { kui:'丑', yue:'未' },
  '乙': { kui:'子', yue:'申' }, '己': { kui:'子', yue:'申' },
  '丙': { kui:'亥', yue:'酉' },
  '丁': { kui:'亥', yue:'酉' },
  '辛': { kui:'午', yue:'寅' },
  '壬': { kui:'卯', yue:'巳' },
  '癸': { kui:'卯', yue:'巳' },
};

// 禄存表（年干）
const LUCUN_TABLE = { '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子' };
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

function calcZiweiDouShu(yearStemChar, yearBranchChar, year, monthIdx, day, hourIdx, gender) {
  // 地支到宫位索引映射（固定的地支位置）
  // 寅=0, 卯=1, 辰=2, 巳=3, 午=4, 未=5, 申=6, 酉=7, 戌=8, 亥=9, 子=10, 丑=11
  const BRANCH_TO_IDX = { '寅':0,'卯':1,'辰':2,'巳':3,'午':4,'未':5,'申':6,'酉':7,'戌':8,'亥':9,'子':10,'丑':11 };
  // 宫位到地支映射（命宫起寅）
  // ZW_BRANCH_MAP will be built dynamically based on ming Palace
  
  // 命宫：从寅宫起正月，顺数到出生月，再从该宫起子时，逆数到出生时辰
  const mingIdx = (2 + monthIdx - 1 - hourIdx + 12) % 12;
  // 身宫：从寅宫起正月，顺数到出生月，再从该宫起子时，顺数到出生时辰
  const shenIdx = (2 + monthIdx - 1 + hourIdx) % 12;
  
  // 12宫对应的地支（命宫所在的地支 = 寅宫顺数mingIdx位）
  const mingBranchIdx = (2 + mingIdx) % 12;
  // 建立宫位→地支的映射
  const ZW_BRANCH_MAP = {};
  for (let i = 0; i < 12; i++) {
    const palaceName = ZW_PALACES[(i - mingIdx + 12) % 12]; // 命宫在mingIdx, 按顺序排列
    const branchIdx = (mingBranchIdx + i) % 12;
    ZW_BRANCH_MAP[palaceName] = branchIdx;
  }

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
  const mingBranch = BRANCHES[(2 + mingIdx) % 12];
  // 命宫天干：以生年天干，用五虎遁诀求之
  const huDunBase = { '甲':0,'己':0,'乙':2,'庚':2,'丙':4,'辛':4,'丁':6,'壬':6,'戊':8,'癸':8 };
  const mingGanIdx = ((huDunBase[yearStemChar] || 0) + BRANCHES.indexOf(mingBranch)) % 10;
  const najiaKey = STEMS[mingGanIdx % 10] + mingBranch;
  const wuxingJu = najiaMap[najiaKey] || '木';

  // 紫微星位置（简化算法）
  const juNum = { '水': 2, '木': 3, '金': 4, '土': 5, '火': 6 };
  const base = juNum[wuxingJu] || 3;
  const dayMod = day % base;
  // 紫微星在十二宫的位置
  const ziweiIdx = (dayMod === 0 ? (base - 1) : (dayMod - 1) + 2) % 12;

  // 安十四主星（紫微系逆排6颗 + 天府系顺排8颗）
  const starPositions = {};
  // 紫微系（紫微为起点逆排）
  const ziweiSeries = [
    { offset: 0, star: '紫微' },
    { offset: -1, star: '天机' },
    { offset: 1, star: null },     // 隔一宫
    { offset: 2, star: '太阳' },
    { offset: 3, star: '武曲' },
    { offset: 4, star: '天同' },
    { offset: 5, star: null },     // 隔二宫
    { offset: 6, star: null },
    { offset: 7, star: '廉贞' },
  ];
  // 天府系（天府为起点顺排）
  const tianfuSeries = [
    { offset: 0, star: '天府' },
    { offset: 1, star: '太阴' },
    { offset: 2, star: '贪狼' },
    { offset: 3, star: '巨门' },
    { offset: 4, star: '天相' },
    { offset: 5, star: '天梁' },
    { offset: 6, star: '七杀' },
    { offset: 7, star: null },
    { offset: 8, star: null },
    { offset: 9, star: null },
    { offset: 10, star: '破军' },
  ];
  // 天府位置 = 4 - 紫微位置（取模12），即紫微+天府=寅(2)
  const tianfuIdx = (4 - ziweiIdx + 12) % 12;

  for (const item of ziweiSeries) {
    if (item.star) starPositions[item.star] = (ziweiIdx + item.offset + 12) % 12;
  }
  for (const item of tianfuSeries) {
    if (item.star) starPositions[item.star] = (tianfuIdx + item.offset) % 12;
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

  // 安四化
  const siHua = SIHUA_TABLE[yearStemChar] || SIHUA_TABLE['甲'];
  const siHuaStars = {};
  for (const [key, star] of Object.entries(siHua)) {
    if (starPositions[star] !== undefined) {
      siHuaStars[star] = { type: key, pos: starPositions[star] };
    }
  }

  // 安六吉星
  const luckyStars = {};
  // 文昌：戌上逆数时支
  const wenchangIdx = (10 - hourIdx + 12) % 12;
  luckyStars['文昌'] = wenchangIdx;
  // 文曲：辰上顺数时支
  luckyStars['文曲'] = (4 + hourIdx) % 12;
  // 左辅：辰上顺数月支
  const monthBranchIdx = monthIdx;
  luckyStars['左辅'] = (4 + monthBranchIdx) % 12;
  // 右弼：戌上逆数月支
  luckyStars['右弼'] = (10 - monthBranchIdx + 12) % 12;
  // 天魁
  const kuiyue = KUIYUE_TABLE[yearStemChar] || KUIYUE_TABLE['甲'];
  luckyStars['天魁'] = BRANCHES.indexOf(kuiyue.kui);
  luckyStars['天钺'] = BRANCHES.indexOf(kuiyue.yue);

  // 安禄存
  const lucunBranch = LUCUN_TABLE[yearStemChar] || '寅';
  const lucunIdx = BRANCHES.indexOf(lucunBranch);

  // 安六煞星
  const fierceStars = {};
  // 擎羊：禄存前一宫
  fierceStars['擎羊'] = (lucunIdx + 1) % 12;
  // 陀罗：禄存后一宫
  fierceStars['陀罗'] = (lucunIdx - 1 + 12) % 12;
  // 火星、铃星（按年支和时支）
  const yearBranchIdx = BRANCHES.indexOf(yearBranchChar);
  const marsBase = (yearBranchIdx % 4) < 2 ? (4 + hourIdx) % 12 : (10 - hourIdx + 12) % 12;
  fierceStars['火星'] = marsBase;
  fierceStars['铃星'] = (marsBase + 6) % 12;
  // 地空：亥上逆数时支
  fierceStars['地空'] = (11 - hourIdx + 12) % 12;
  // 地劫：亥上顺数时支
  fierceStars['地劫'] = (11 + hourIdx) % 12;

  // 天马（按年支）
  const tianmaMap = { '寅':'申','申':'寅','巳':'亥','亥':'巳' };
  const tianmaIdx = BRANCHES.indexOf(tianmaMap[BRANCHES[yearBranchIdx]] || '寅');

  // 合并所有星曜到宫位
  const allStarsInPalaces = {};
  for (const [star, pos] of Object.entries(starPositions)) {
    if (!allStarsInPalaces[ZW_PALACES[pos]]) allStarsInPalaces[ZW_PALACES[pos]] = [];
    allStarsInPalaces[ZW_PALACES[pos]].push(star);
  }
  for (const [star, pos] of Object.entries(luckyStars)) {
    if (!allStarsInPalaces[ZW_PALACES[pos]]) allStarsInPalaces[ZW_PALACES[pos]] = [];
    allStarsInPalaces[ZW_PALACES[pos]].push(star);
  }
  for (const [star, pos] of Object.entries(fierceStars)) {
    if (!allStarsInPalaces[ZW_PALACES[pos]]) allStarsInPalaces[ZW_PALACES[pos]] = [];
    allStarsInPalaces[ZW_PALACES[pos]].push(star);
  }
  if (!allStarsInPalaces[ZW_PALACES[lucunIdx]]) allStarsInPalaces[ZW_PALACES[lucunIdx]] = [];
  allStarsInPalaces[ZW_PALACES[lucunIdx]].push('禄存');
  if (!allStarsInPalaces[ZW_PALACES[tianmaIdx]]) allStarsInPalaces[ZW_PALACES[tianmaIdx]] = [];
  allStarsInPalaces[ZW_PALACES[tianmaIdx]].push('天马');

  // 标记四化星所在的宫位
  const siHuaByPalace = {};
  for (const [star, info] of Object.entries(siHuaStars)) {
    const palace = ZW_PALACES[info.pos];
    if (!siHuaByPalace[palace]) siHuaByPalace[palace] = [];
    siHuaByPalace[palace].push({ star, type: info.type });
  }

  // 给每个宫位标注星曜类型（主星/吉星/煞星）和亮度
  const palaceDetails = {};
  for (let i = 0; i < 12; i++) {
    const name = ZW_PALACES[i];
    const stars = allStarsInPalaces[name] || [];
    const mainStars = stars.filter(s => ZW_STARS.includes(s));
    const luckyStarList = stars.filter(s => ZW_LUCKY_STARS.includes(s) || s === '禄存' || s === '天马');
    const fierceStarList = stars.filter(s => ZW_FIERCE_STARS.includes(s));
    const siHuas = siHuaByPalace[name] || [];
    
    // 亮度判定（简化：基于宫位与星曜五行生克）
    const starBrightness = {};
    mainStars.forEach(s => {
      const swx = ZW_STAR_WUXING[s];
      const bw = BRANCH_WUXING[BRANCHES[ZW_BRANCH_MAP[name]]];
      // 五行比和=庙，生我=旺，我生=得，我克=利，克我=平，生克皆不利=陷
      if (swx === bw) starBrightness[s] = '庙';
      else if ((swx === '木' && bw === '水') || (swx === '火' && bw === '木') || (swx === '土' && bw === '火') || (swx === '金' && bw === '土') || (swx === '水' && bw === '金')) starBrightness[s] = '旺';
      else if ((swx === '水' && bw === '木') || (swx === '木' && bw === '火') || (swx === '火' && bw === '土') || (swx === '土' && bw === '金') || (swx === '金' && bw === '水')) starBrightness[s] = '得';
      else if ((swx === '木' && bw === '土') || (swx === '土' && bw === '水') || (swx === '水' && bw === '火') || (swx === '火' && bw === '金') || (swx === '金' && bw === '木')) starBrightness[s] = '利';
      else starBrightness[s] = '平';
    });

    palaceDetails[name] = {
      branch: BRANCHES[ZW_BRANCH_MAP[name]],
      mainStars,
      mainStarBrightness: starBrightness,
      luckyStars: luckyStarList,
      fierceStars: fierceStarList,
      siHuas
    };
  }

  // 重点宫位详细解读
  const keyPalaces = ['命宫', '财帛', '官禄', '夫妻', '田宅', '福德', '疾厄', '迁移'];
  const keyAnalysis = {};
  for (const p of keyPalaces) {
    const detail = palaceDetails[p];
    let text = '';
    if (detail.mainStars.length > 0) {
      text += `主星：${detail.mainStars.join('、')}`;
      // 亮度
      const bris = detail.mainStars.map(s => `${s}(${detail.mainStarBrightness[s]})`).join(' ');
      text += ` [${bris}]`;
    } else {
      text += '无主星，借对宫参考';
    }
    if (detail.luckyStars.length > 0) text += `；吉星：${detail.luckyStars.join('、')}`;
    if (detail.fierceStars.length > 0) text += `；煞星：${detail.fierceStars.join('、')}`;
    if (detail.siHuas.length > 0) {
      const sh = detail.siHuas.map(sh => `${sh.star}化${sh.type === 'lu' ? '禄' : sh.type === 'quan' ? '权' : sh.type === 'ke' ? '科' : '忌'}`).join('、');
      text += `；四化：${sh}`;
    }
    keyAnalysis[p] = text;
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
    palaceDetails,
    keyAnalysis,
    starPositions,
    sanfangStars,
    siHuaTable: siHua,
    siHuaByPalace
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

// ============================================================
// 五运六气计算（黄帝内经）
// ============================================================

// 五运（天干化运）
const YUN_TABLE = {
  '甲': { yun: '土运', type: '太过' },
  '己': { yun: '土运', type: '不及' },
  '乙': { yun: '金运', type: '不及' },
  '庚': { yun: '金运', type: '太过' },
  '丙': { yun: '水运', type: '太过' },
  '辛': { yun: '水运', type: '不及' },
  '丁': { yun: '木运', type: '不及' },
  '壬': { yun: '木运', type: '太过' },
  '戊': { yun: '火运', type: '太过' },
  '癸': { yun: '火运', type: '不及' }
};

// 六气司天/在泉（年支）
const LIUQI_SIZAI = {
  '子': { siTian: '少阴君火', zaiQuan: '阳明燥金' },
  '午': { siTian: '少阴君火', zaiQuan: '阳明燥金' },
  '丑': { siTian: '太阴湿土', zaiQuan: '太阳寒水' },
  '未': { siTian: '太阴湿土', zaiQuan: '太阳寒水' },
  '寅': { siTian: '少阳相火', zaiQuan: '厥阴风木' },
  '申': { siTian: '少阳相火', zaiQuan: '厥阴风木' },
  '卯': { siTian: '阳明燥金', zaiQuan: '少阴君火' },
  '酉': { siTian: '阳明燥金', zaiQuan: '少阴君火' },
  '辰': { siTian: '太阳寒水', zaiQuan: '太阴湿土' },
  '戌': { siTian: '太阳寒水', zaiQuan: '太阴湿土' },
  '巳': { siTian: '厥阴风木', zaiQuan: '少阳相火' },
  '亥': { siTian: '厥阴风木', zaiQuan: '少阳相火' }
};

// 三阴三阳顺序（客气排列用）
const SANYIN_SANYANG = ['厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水'];
// 六步对应月份和节气
const LIUBU_SOLAR = [
  { name: '初之气', solar: '大寒→春分', months: '1月下旬-3月中旬', nature: '升发' },
  { name: '二之气', solar: '春分→小满', months: '3月下旬-5月中旬', nature: '生长' },
  { name: '三之气', solar: '小满→大暑', months: '5月下旬-7月中旬', nature: '繁盛' },
  { name: '四之气', solar: '大暑→秋分', months: '7月下旬-9月中旬', nature: '化湿' },
  { name: '五之气', solar: '秋分→小雪', months: '9月下旬-11月中旬', nature: '肃降' },
  { name: '终之气', solar: '小雪→大寒', months: '11月下旬-1月中旬', nature: '封藏' }
];

// 六气五行属性
const LIUQI_WUXING = {
  '厥阴风木': '木', '少阴君火': '火', '少阳相火': '火',
  '太阴湿土': '土', '阳明燥金': '金', '太阳寒水': '水'
};

// 六气影响脏腑
const LIUQI_ZANGFU = {
  '厥阴风木': { zang: '肝', fu: '胆', desc: '风气通肝，易致肝气郁结、头目眩晕、筋脉拘挛' },
  '少阴君火': { zang: '心', fu: '小肠', desc: '热气通心，易致心烦失眠、口舌生疮、心悸怔忡' },
  '少阳相火': { zang: '心包', fu: '三焦', desc: '相火妄动，易致内热烦躁、疮疡肿毒、发热不退' },
  '太阴湿土': { zang: '脾', fu: '胃', desc: '湿气通脾，易致腹胀泄泻、身体困重、痰饮水肿' },
  '阳明燥金': { zang: '肺', fu: '大肠', desc: '燥气通肺，易致咳嗽咽干、皮肤干燥、大便干结' },
  '太阳寒水': { zang: '肾', fu: '膀胱', desc: '寒气通肾，易致畏寒肢冷、腰膝冷痛、小便不利' }
};

// 五运太过不及的详细解读
const YUN_DETAIL = {
  '木运': {
    taiGuo: { desc: '木运太过，风气盛行。木盛克土，脾胃易伤。', weather: '多风，春行夏令', health: '肝气偏旺，易头痛眩晕、胁痛易怒；脾胃受克，消化力弱' },
    buJi: { desc: '木运不及，燥气来乘。金胜木衰，生机不展。', weather: '风少燥多，春有秋象', health: '肝气不足，易疲劳乏力、目涩筋软；肺金来克，易咳嗽胸闷' }
  },
  '火运': {
    taiGuo: { desc: '火运太过，炎暑流行。火盛克金，肺金受邪。', weather: '炎热异常，夏有冬象不常', health: '心火亢盛，易心烦失眠、口舌生疮；肺金受克，易咳喘咽痛' },
    buJi: { desc: '火运不及，寒来乘之。水胜火衰，阳气不振。', weather: '夏季不热，寒气偏胜', health: '心阳不足，易心悸气短、畏寒肢冷；肾水来克，易腰膝酸软' }
  },
  '土运': {
    taiGuo: { desc: '土运太过，雨湿流行。土盛克水，肾水受邪。', weather: '雨水偏多，湿气弥漫', health: '脾胃湿困，易腹胀纳呆、身体沉重；肾水受克，易水肿小便不利' },
    buJi: { desc: '土运不及，风来乘之。木胜土衰，运化无力。', weather: '雨水偏少，风气偏胜', health: '脾胃虚弱，易消化不良、四肢无力；肝木来克，易情绪抑郁' }
  },
  '金运': {
    taiGuo: { desc: '金运太过，燥气流行。金盛克木，肝木受邪。', weather: '干燥少雨，秋行春令', health: '肺燥津亏，易干咳少痰、皮肤干燥；肝木受克，易两胁胀痛' },
    buJi: { desc: '金运不及，热来乘之。火胜金衰，肃降无力。', weather: '燥气不足，温热偏胜', health: '肺气虚弱，易感冒咳嗽、气短汗出；心火来克，易口腔溃疡' }
  },
  '水运': {
    taiGuo: { desc: '水运太过，寒气流行。水盛克火，心火受邪。', weather: '冬季严寒，寒气侵人', health: '肾寒阳衰，易畏寒肢冷、腰膝冷痛；心火受克，易胸闷心悸' },
    buJi: { desc: '水运不及，湿来乘之。土胜水衰，封藏失职。', weather: '冬季不寒，湿气偏胜', health: '肾气不足，易耳鸣健忘、夜尿频繁；脾湿来克，易腹胀便溏' }
  }
};

// 五运六气之间的生克关系解读
function analyzeYunQiRelation(yearYun, yearYunType, siTian, zaiQuan) {
  const yw = yearYun.replace('运', '');
  const stw = LIUQI_WUXING[siTian];
  const zqw = LIUQI_WUXING[zaiQuan];

  let relation = '';

  if (yw === stw) {
    relation = '岁运与司天之气同气，谓之"天符"年。气候变化剧烈，同气相应，该类病邪易于流行。';
  } else {
    const overcomes = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };
    const generates = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };

    if (stw === overcomes[yw]) {
      relation = `司天${stw}克岁运${yw}，谓之"天刑"年。司天之气克制中运，气候变化异常，上半年需防${siTian}相关的疾病。`;
    } else if (yw === overcomes[stw]) {
      relation = `岁运${yw}克司天${stw}，谓之"不和"年。中运克制司天，气候变化相对缓和但仍需关注。`;
    } else if (generates[yw] === stw) {
      relation = `岁运${yw}生司天${stw}，运生气，谓之"小逆"年。气候变化较好，但岁运之气有所损耗。`;
    } else if (generates[stw] === yw) {
      relation = `司天${stw}生岁运${yw}，气生运，谓之"顺化"年。气候变化平和，是为吉年。`;
    } else {
      relation = `岁运${yw}与司天${stw}不相克制，气候变化相对平稳。`;
    }
  }

  return relation;
}

function calcWuYunLiuQi(yearStemChar, yearBranchChar, dayStem, dayZhi, daoyi) {
  // 1. 本年五运
  const yunInfo = YUN_TABLE[yearStemChar];
  const yunName = yunInfo.yun;
  const yunType = yunInfo.type;
  const yunDetail = YUN_DETAIL[yunName][yunType === '太过' ? 'taiGuo' : 'buJi'];

  // 2. 本年六气
  const qiInfo = LIUQI_SIZAI[yearBranchChar];
  const siTian = qiInfo.siTian;   // 司天（上半年）
  const zaiQuan = qiInfo.zaiQuan; // 在泉（下半年）

  // 3. 客气六步（从司天开始按三阴三阳顺序排列）
  const siTianIdx = SANYIN_SANYANG.indexOf(siTian);
  const keQiOrder = [];
  for (let i = 0; i < 6; i++) {
    keQiOrder.push(SANYIN_SANYANG[(siTianIdx + i) % 6]);
  }
  // 客气顺序：三之气=司天，初之气=从司天逆推两位，终之气=在泉
  // 正确顺序：初之气=前一位的三阴三阳，以此类推
  // 司天为三之气，在泉为终之气(六之气)

  // 4. 主气六步（固定）
  const zhuQiOrder = ['厥阴风木', '少阴君火', '少阳相火', '太阴湿土', '阳明燥金', '太阳寒水'];

  // 5. 构建六步详情
  const liuBu = [];
  for (let i = 0; i < 6; i++) {
    const zhu = zhuQiOrder[i];
    const ke = keQiOrder[i];
    liuBu.push({
      ...LIUBU_SOLAR[i],
      zhuQi: zhu,
      zhuQiWuxing: LIUQI_WUXING[zhu],
      keQi: ke,
      keQiWuxing: LIUQI_WUXING[ke],
      keQiZangFu: LIUQI_ZANGFU[ke]
    });
  }

  // 6. 岁运与司天关系
  const yunQiRelation = analyzeYunQiRelation(yunName, yunType, siTian, zaiQuan);

  // 7. 个人体质与本年五运六气的匹配分析
  const birthWuxing = STEM_WUXING[dayStem];
  const dayWuxingName = birthWuxing;

  // 检查个人体质是否受本年五运六气影响
  const personalImpact = [];
  const overcomes = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };
  const generates = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };

  const yunWuxing = yunName.replace('运', '');
  const siTianWuxing = LIUQI_WUXING[siTian];
  const zaiQuanWuxing = LIUQI_WUXING[zaiQuan];

  // 岁运对个人影响
  if (yunWuxing === generates[dayWuxingName]) {
    personalImpact.push(`岁运${yunName}生您日主${dayWuxingName}，本年天地之气对您有生助之益，是运势上升之年。`);
  } else if (dayWuxingName === generates[yunWuxing]) {
    personalImpact.push(`您日主${dayWuxingName}生岁运${yunName}，本年需付出较多精力，宜守不宜攻，注意保养元气。`);
  } else if (yunWuxing === dayWuxingName) {
    personalImpact.push(`岁运${yunName}与您日主同属${dayWuxingName}，本年比肩相助，贵人运旺，适合发展合作。`);
  } else if (yunWuxing === overcomes[dayWuxingName]) {
    personalImpact.push(`⚠️ 岁运${yunName}克您日主${dayWuxingName}，本年需特别注意健康，防范意外，做事谨慎为要。`);
  } else if (dayWuxingName === overcomes[yunWuxing]) {
    personalImpact.push(`您日主${dayWuxingName}克岁运${yunName}，本年虽有挑战但能应对，适合主动出击。`);
  }

  // 司天对个人影响
  if (siTianWuxing === generates[dayWuxingName]) {
    personalImpact.push(`上半年司天${siTian}之气生您日主，上半年运势有利，身心健康。`);
  } else if (siTianWuxing === overcomes[dayWuxingName]) {
    personalImpact.push(`⚠️ 上半年司天${siTian}之气克您日主，上半年需注意${LIUQI_ZANGFU[siTian]?.desc || '相关健康问题'}。`);
  }

  // 在泉对个人影响
  if (zaiQuanWuxing === generates[dayWuxingName]) {
    personalImpact.push(`下半年在泉${zaiQuan}之气生您日主，下半年运势好转，收成有利。`);
  } else if (zaiQuanWuxing === overcomes[dayWuxingName]) {
    personalImpact.push(`⚠️ 下半年在泉${zaiQuan}之气克您日主，下半年需注意${LIUQI_ZANGFU[zaiQuan]?.desc || '相关健康问题'}。`);
  }

  // 8. 综合防病建议（结合道医体质）
  const healthAdvice = [];
  
  // 基于司天的防病建议
  if (siTianWuxing) {
    const szf = LIUQI_ZANGFU[siTian];
    if (szf) {
      healthAdvice.push(`本年司天${siTian}，重点养护${szf.zang}${szf.fu}。${szf.desc}。`);
    }
  }

  // 基于在泉的建议
  if (zaiQuanWuxing) {
    const zzf = LIUQI_ZANGFU[zaiQuan];
    if (zzf) {
      healthAdvice.push(`下半年在泉${zaiQuan}，需兼顾${zzf.zang}${zzf.fu}的调养。${zzf.desc}。`);
    }
  }

  // 结合个人体质
  if (daoyi && daoyi.primaryType) {
    healthAdvice.push(`结合您的${daoyi.primaryType}，本年${yunType === '太过' ? '气运偏盛' : '气运偏衰'}的气候环境下，${yunDetail.health}。`);
  }

  // 9. 逐月调养提示
  const monthlyYangSheng = [];
  for (let m = 1; m <= 12; m++) {
    let buIdx;
    if (m <= 1 || m === 12) buIdx = 5; // 终之气
    else if (m <= 3) buIdx = 0; // 初之气
    else if (m <= 5) buIdx = 1; // 二之气
    else if (m <= 7) buIdx = 2; // 三之气
    else if (m <= 9) buIdx = 3; // 四之气
    else buIdx = 4; // 五之气

    const bu = liuBu[buIdx];
    // 当前月份对应六步的月养提示
    const zf = LIUQI_ZANGFU[bu.keQi];
    monthlyYangSheng.push({
      month: m,
      liuBuName: bu.name,
      keQi: bu.keQi,
      zangFu: zf ? `${zf.zang}/${zf.fu}` : '',
      tip: zf ? `当令之气为${bu.keQi}，宜调养${zf.zang}${zf.fu}` : ''
    });
  }

  return {
    yearYun: yunName,
    yearYunType: yunType,
    yearYunDetail: yunDetail,
    siTian,
    siTianWuxing,
    zaiQuan,
    zaiQuanWuxing,
    yunQiRelation,
    liuBu,
    personalImpact,
    healthAdvice,
    monthlyYangSheng,
    summary: `${yunName}${yunType}之年，司天${siTian}，在泉${zaiQuan}。${yunDetail.desc} ${yunQiRelation}`
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
  const ziwei = calcZiweiDouShu(yearGan, yearZhi, year, month - 1, day, BRANCHES.indexOf(HOUR_BRANCH[hourName] || '子'), gender);
  // 面相
  const mianxiang = calcMianXiang(dayGan, gender);
  // 手相
  const shouxiang = calcShouXiang(dayGan, gender);
  // 风水
  const fengshui = calcFengshui(yongShen, STEM_WUXING[dayGan]);
  // 道医体质
  const daoyi = calcDaoYiTiZhi(dayGan, dayZhi, monthZhi, wuxingCount, strength);
  // 五运六气
  const wuyunliuqi = calcWuYunLiuQi(yearGan, yearZhi, dayGan, dayZhi, daoyi);

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
    dayZhiWuxing: BRANCH_WUXING[dayZhi],
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
    fengshui,
    daoyi,
    wuyunliuqi
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
