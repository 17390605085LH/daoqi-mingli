# 命理服务网站 · 设计规范 (SPEC.md)

## 1. Concept & Vision

**道器合一 · 数智命理**

一个以「科学态度诠释传统智慧」为核心理念的命理服务网站。不谈迷信，只谈依据经典典籍的五行推演与人生周期分析。视觉上以东方古典美学为骨，以现代科技感为魂——让人感受的是「智慧」而非「玄学」。

---

## 2. Design Language

### 美学方向
**墨金典雅 × 赛博玄学**：深邃玄黑为底，帝王金为光，紫气东来为韵。整体氛围是「古代智者在数字世界的道场」——庄严、可信、精致。

### 色彩系统
```
--color-void:        #080B14    /* 虚空黑：背景底色 */
--color-obsidian:    #0D1117    /* 玄黑：主要背景 */
--color-ink:         #1A1F2E    /* 墨色：卡片背景 */
--color-gold:        #C9A84C    /* 帝王金：强调色 */
--color-gold-light:  #E8C97A    /* 流金：hover态 */
--color-purple:      #6B5B95    /* 紫气：辅助色 */
--color-jade:        #4A9E8B    /* 翠玉：正向指标 */
--color-cinnabar:    #C75B5B    /* 朱砂：警示/负向指标 */
--color-text:        #E8E0D4    /* 月白：主要文字 */
--color-text-muted:  #8B8577    /* 烟灰：辅助文字 */
--color-border:      rgba(201,168,76,0.15) /* 金边 */
```

### 字体
- **标题 / Logo**: `Noto Serif SC` (Google Fonts) — 宋体古典感
- **正文**: `Noto Sans SC` — 无衬线现代感
- **数字 / 干支**: `ZCOOL XiaoWei` 或 fallback `serif`

### 动效哲学
- **入场**: 从下方淡入（opacity 0→1, translateY 30px→0, 600ms ease-out）
- **悬停**: 毛玻璃加深 + 金色光晕（box-shadow glow, 200ms）
- **背景**: 缓慢粒子漂浮（模拟灵气流动），10-20个发光粒子
- **墨迹**: SVG 路径描边动画，模拟毛笔书写
- **流转**: 五行/大运切换时横向滑动过渡

### 图标系统
- 使用 **Lucide Icons**（线性风格）
- 干支符号使用 SVG 自绘

---

## 3. Layout & Structure

### 页面架构

```
/
├── index.html          # 落地首页
├── form.html           # 生辰信息收集
├── report.html         # 命理报告展示
├── checkout.html       # 付费方案选择
└── css/
    └── style.css       # 全局样式
```

### 首页结构
1. **Nav**: Logo + 导航 + 开始测算按钮
2. **Hero**: 全屏，粒子背景，主标语 + 子标语 + CTA
3. **Features**: 三大核心能力（卡片横排）
4. **Services**: 付费等级展示（3列定价卡）
5. **Process**: 测算流程（时间轴）
6. **Testimonials**: 用户评价（轮播）
7. **Footer**: 版权 + 链接

### 响应式策略
- Desktop: 1200px max-width, 3列布局
- Tablet (768px): 2列, 汉堡菜单
- Mobile (375px): 单列, 底部固定CTA

---

## 4. Features & Interactions

### 首页
- 粒子背景在首屏持续流动
- Hero 文字逐字入场动画
- 「立即测算」按钮：点击 smooth scroll 到付费方案

### 表单页 (form.html)
- 步骤条显示当前进度（1→2→3）
- Step1: 姓名 + 性别
- Step2: 出生日期（公历/农历切换）+ 出生时辰（时辰选择器）
- Step3: 出生地（自动补全）
- 验证：所有必填项，日期合理性
- 提交后跳转到报告页（演示模式）/ 付费页（生产模式）

### 报告页 (report.html)
- 顶部：姓名 + 八字摘要 + 五行分布饼图
- 模块卡片：
  - 🔥 五行偏性分析
  - 🚀 十年大运（可左右滑动切换大运）
  - 📅 流年走势
  - 🎯 小限分析
  - 💡 趋吉避凶建议
- 每个模块可展开/折叠
- 底部：根据付费等级解锁内容 + 付费升级 CTA

### 付费页 (checkout.html)
- 三个等级：
  - **入门（¥68）**: 基础五行分析 + 当年流年
  - **深入（¥198）**: 全部模块 + 十年大运
  - **尊享（¥398）**: 完整报告 + 趋吉避凶 + 一年追踪
- 微信/支付宝支付按钮（UI占位）
- 购买后解锁对应内容

---

## 5. Component Inventory

### Button
- Primary: 金色描边 + 透明底，hover时填充金色
- Ghost: 文字按钮，下划线hover动效
- 禁用态: 50% opacity, 禁用cursor

### Card
- 背景: `rgba(26,31,46,0.8)` + `backdrop-filter: blur(20px)`
- 边框: 1px solid `--color-border`
- hover: 金色外发光 + 微微上浮
- 圆角: 16px

### Input / Select
- 背景: `rgba(13,17,23,0.8)`
- 边框: 1px solid rgba(201,168,76,0.3)
- focus: 边框变金色 + glow
- 日期选择器自定义样式

### Pricing Card
- 标准卡：墨色背景
- 推荐卡（中间档）：金色边框 + "热门" 标签
- CTA按钮固定底部

### Badge / Tag
- 五行颜色标签（金/木/水/火/土 各有对应色）

### 八字展示组件
- 四柱横排，年月日时
- 天干地支用不同颜色区分
- 藏干在下方小字显示

### 五行分布图
- CSS实现的五角饼图（或SVG）
- 五行各占一角，颜色对应其属性色

---

## 6. Technical Approach

### 技术栈
- **纯前端**: HTML5 + CSS3 + Vanilla JS（无框架，v1最简方案）
- **CSS**: CSS Variables + Flexbox/Grid + @media queries
- **动效**: CSS Animations + requestAnimationFrame（粒子）
- **图标**: Lucide CDN

### 性能目标
- 首屏 < 1MB（不含CDN资源）
- LCP < 2.5s
- 无任何后端依赖（演示版）

### 未来扩展
- React/Next.js 重构
- 后端 API（用户数据存储、支付）
- 真实排盘算法接入（`bazi-skill` 的排盘逻辑）