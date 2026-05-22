/**
 * 道器命理 - 核心脚本
 * 包含：支付验证、客服小助手、报告分层
 */

// ============================================================
// 1. 客服小助手 - 数字客服浮窗
// ============================================================
(function() {
  if (document.getElementById('customer-service')) return;

  const cs = document.createElement('div');
  cs.id = 'customer-service';
  cs.innerHTML = `
    <button class="cs-trigger" id="csTrigger" aria-label="联系客服">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
    <div class="cs-panel" id="csPanel" style="display:none;">
      <div class="cs-header">
        <h3>道器客服</h3>
        <p>您的反馈将直达创始人</p>
        <button class="cs-close" id="csClose">&times;</button>
      </div>
      <div class="cs-body">
        <form id="csForm">
          <div class="cs-field">
            <label>称呼</label>
            <input type="text" name="name" placeholder="怎么称呼您？" required>
          </div>
          <div class="cs-field">
            <label>联系方式</label>
            <input type="text" name="contact" placeholder="微信/手机/邮箱（选填）">
          </div>
          <div class="cs-field">
            <label>反馈内容</label>
            <textarea name="message" rows="4" placeholder="您的建议、问题或合作意向..." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary cs-submit" id="csSubmit">发送反馈</button>
        </form>
        <div id="csSuccess" style="display:none;text-align:center;padding:2rem 0;">
          <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
          <h4>反馈已发送！</h4>
          <p style="color:var(--color-text-muted);">创始人将尽快回复您</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(cs);

  // Toggle
  document.getElementById('csTrigger').addEventListener('click', function() {
    const panel = document.getElementById('csPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('csClose').addEventListener('click', function() {
    document.getElementById('csPanel').style.display = 'none';
  });

  // Submit
  document.getElementById('csForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('csSubmit');
    btn.disabled = true;
    btn.textContent = '发送中...';

    const formData = new FormData(this);
    const data = {
      name: formData.get('name'),
      contact: formData.get('contact'),
      message: formData.get('message'),
      time: new Date().toISOString()
    };

    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (resp.ok) {
        document.getElementById('csForm').style.display = 'none';
        document.getElementById('csSuccess').style.display = 'block';
      } else {
        throw new Error('Network error');
      }
    } catch (err) {
      alert('发送失败，请稍后重试。或直接联系创始人微信。');
      btn.disabled = false;
      btn.textContent = '发送反馈';
    }
  });
})();


// ============================================================
// 2. 支付安全防护
// ============================================================
(function() {
  // Rate limiting: prevent rapid clicks
  let lastPaymentAttempt = 0;
  const PAYMENT_COOLDOWN = 3000; // 3 seconds

  // 重新包装 processPayment
  if (typeof window.originalProcessPayment === 'undefined') {
    window.originalProcessPayment = window.processPayment;
  }

  window.processPayment = function() {
    const now = Date.now();
    if (now - lastPaymentAttempt < PAYMENT_COOLDOWN) {
      alert('操作太频繁，请稍后再试');
      return;
    }
    lastPaymentAttempt = now;

    // Check terms agreement
    const termsCheckbox = document.getElementById('termsAgree');
    if (termsCheckbox && !termsCheckbox.checked) {
      alert('请先同意服务条款和隐私政策');
      return;
    }

    // Validate plan is selected
    if (selectedPlan === null) {
      alert('请先选择服务方案');
      return;
    }

    // Call original
    if (typeof window.originalProcessPayment === 'function') {
      window.originalProcessPayment();
    }
  };

  // Inject terms checkbox into checkout page
  if (document.querySelector('.checkout-page')) {
    const paySection = document.querySelector('.checkout-page div[style*="text-align: center"][style*="padding"]');
    if (paySection) {
      const termsDiv = document.createElement('div');
      termsDiv.style.cssText = 'margin-bottom:1rem;text-align:center;';
      termsDiv.innerHTML = `
        <label style="display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--color-text-muted);font-size:0.875rem;">
          <input type="checkbox" id="termsAgree" required style="accent-color:var(--color-gold);">
          我已阅读并同意 <a href="terms.html" target="_blank" style="color:var(--color-gold);">服务条款</a> 和 <a href="privacy.html" target="_blank" style="color:var(--color-gold);">隐私政策</a>
        </label>
      `;
      paySection.parentNode.insertBefore(termsDiv, paySection);
    }
  }
})();


// ============================================================
// 3. 报告分层 - 免费 vs 付费
// ============================================================
(function() {
  if (!document.querySelector('.report-page')) return;

  const urlParams = new URLSearchParams(window.location.search);
  const plan = urlParams.get('plan') || 'free';

  const isFree = (plan === 'free' || plan === '尝鲜版');
  const isBasic = (plan === '学生版');
  const isPro = (plan === '职场版');
  const isAdvanced = (plan === '进阶版');
  const isFull = (plan === '专业版') || (plan === '山医问诊') || (plan === '八字合盘') || (plan === '易名定制') || (plan === '年度顾问');

  // Inject tier indicator at top
  const header = document.querySelector('.report-header');
  if (header) {
    const badge = document.createElement('div');
    badge.className = 'report-tier-badge';
    const tierName = isFree ? '免费体验版' : plan;
    const tierColor = isFree ? 'var(--color-text-muted)' : 'var(--color-gold)';
    badge.style.cssText = `
      display:inline-block;padding:0.25rem 1rem;border-radius:100px;
      font-size:0.8rem;font-weight:600;margin-bottom:1rem;
      background:${tierColor}15;color:${tierColor};border:1px solid ${tierColor}30;
    `;
    badge.textContent = tierName;
    header.insertBefore(badge, header.firstChild);
  }

  // Lock indicator component
  function createLockBadge(upgradeText) {
    const div = document.createElement('div');
    div.className = 'lock-badge';
    div.innerHTML = `
      <div class="lock-overlay">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p>${upgradeText || '升级解锁完整内容'}</p>
        <a href="checkout.html" class="btn btn-primary" style="margin-top:0.75rem;font-size:0.85rem;">解锁完整报告</a>
      </div>
    `;
    return div;
  }

  // Free tier: enhance visible content, lock premium sections
  if (isFree) {
    // --- 新增免费内容区域 ---
    const sections = document.querySelector('.report-sections');
    if (sections) {
      // 注入免费专属内容（在五行分析之后）
      const wuxingCard = sections.querySelector('.report-card');
      if (wuxingCard) {
        // 性格特征
        const personalityCard = document.createElement('div');
        personalityCard.className = 'card report-card expanded';
        personalityCard.innerHTML = `
          <div class="report-card-header" onclick="toggleCard(this.parentElement)">
            <div class="report-card-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
            <div class="report-card-title"><h3>日主与性格</h3><p>了解自己，顺势而为</p></div>
            <div class="report-card-toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
          <div class="report-card-content">
            <p>日主<span style="color:var(--color-gold);font-weight:600;">丙火</span>，如太阳般热情洋溢、光明磊落。丙火之人天生具有领导气质，待人真诚且富有感染力。</p>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-md);margin-top:var(--space-md);">
              <div style="padding:var(--space-md);background:var(--color-ink);border-radius:var(--radius-sm);">
                <div style="font-size:0.875rem;color:var(--color-text-muted);">优势特质</div>
                <ul style="list-style:none;margin-top:var(--space-xs);">
                  <li>✓ 热情阳光，感染力强</li>
                  <li>✓ 洞察力敏锐</li>
                  <li>✓ 行动力充沛</li>
                  <li>✓ 社交能力出色</li>
                </ul>
              </div>
              <div style="padding:var(--space-md);background:var(--color-ink);border-radius:var(--radius-sm);">
                <div style="font-size:0.875rem;color:var(--color-text-muted);">需注意</div>
                <ul style="list-style:none;margin-top:var(--space-xs);">
                  <li>⚠ 有时过于急躁</li>
                  <li>⚠ 情绪波动较大</li>
                  <li>⚠ 容易三分钟热度</li>
                  <li>⚠ 需培养耐心</li>
                </ul>
              </div>
            </div>
          </div>`;
        wuxingCard.after(personalityCard);

        // 喜用神
        const yongshenCard = document.createElement('div');
        yongshenCard.className = 'card report-card expanded';
        yongshenCard.innerHTML = `
          <div class="report-card-header" onclick="toggleCard(this.parentElement)">
            <div class="report-card-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
            <div class="report-card-title"><h3>喜用神分析</h3><p>补益命局的关键五行</p></div>
            <div class="report-card-toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
          <div class="report-card-content">
            <p style="margin-bottom:var(--space-md);"><span style="color:var(--color-gold);font-weight:600;">用神：金</span> — 丙火过旺，需金来耗泄火气，同时生水制火。</p>
            <p style="margin-bottom:var(--space-md);"><span style="color:var(--color-jade);font-weight:600;">喜神：水</span> — 水可直接克制丙火，达到平衡。</p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);margin-top:var(--space-md);">
              <div style="text-align:center;padding:var(--space-sm);background:var(--color-ink);border-radius:var(--radius-sm);">
                <div style="font-size:1.5rem;">🧭</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem;">幸运方位</div>
                <div style="font-weight:600;">西 / 西北</div>
              </div>
              <div style="text-align:center;padding:var(--space-sm);background:var(--color-ink);border-radius:var(--radius-sm);">
                <div style="font-size:1.5rem;">🎨</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem;">幸运颜色</div>
                <div style="font-weight:600;">白 / 金 / 蓝</div>
              </div>
              <div style="text-align:center;padding:var(--space-sm);background:var(--color-ink);border-radius:var(--radius-sm);">
                <div style="font-size:1.5rem;">🔢</div>
                <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem;">幸运数字</div>
                <div style="font-weight:600;">4, 9, 1, 6</div>
              </div>
            </div>
          </div>`;
        personalityCard.after(yongshenCard);

        // 流月简析
        const liuyueCard = document.createElement('div');
        liuyueCard.className = 'card report-card';
        liuyueCard.innerHTML = `
          <div class="report-card-header" onclick="toggleCard(this.parentElement)">
            <div class="report-card-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <div class="report-card-title"><h3>流月简析</h3><p>当前年度各月走势</p></div>
            <div class="report-card-toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
          <div class="report-card-content">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-xs);">
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>1月</strong><br><span style="color:var(--color-jade);">平稳</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>2月</strong><br><span style="color:var(--color-gold);">上升</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>3月</strong><br><span style="color:var(--color-gold);">机遇</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>4月</strong><br><span style="color:var(--color-cinnabar);">波动</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>5月</strong><br><span style="color:var(--color-jade);">回升</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>6月</strong><br><span style="color:var(--color-gold);">旺盛</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>7月</strong><br><span style="color:var(--color-cinnabar);">消耗</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>8月</strong><br><span style="color:var(--color-jade);">平稳</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>9月</strong><br><span style="color:var(--color-gold);">收获</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>10月</strong><br><span style="color:var(--color-cinnabar);">压力</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>11月</strong><br><span style="color:var(--color-jade);">回暖</span></div>
              <div style="padding:var(--space-xs);text-align:center;font-size:0.8rem;"><strong>12月</strong><br><span style="color:var(--color-gold);">上升</span></div>
            </div>
          </div>`;
        yongshenCard.after(liuyueCard);
      }

      // 对已有的"十年大运"和"流年走势"卡片加锁（免费版看不到详细内容）
      const allCards = sections.querySelectorAll('.report-card');
      allCards.forEach(card => {
        const title = card.querySelector('.report-card-title h3');
        if (title && (title.textContent.includes('十年大运') || title.textContent.includes('流年走势'))) {
          // 保留折叠状态的内容但标记为 locked
          card.classList.remove('expanded');
          const content = card.querySelector('.report-card-content');
          if (content) {
            content.style.position = 'relative';
            const lockEl = createLockBadge('付费版解锁大运与流年详细解读');
            content.appendChild(lockEl);
          }
        }
      });
    }
  }

  // 付费版: 去掉锁，显示全部内容
  if (!isFree) {
    // 移除所有锁标记
    document.querySelectorAll('.lock-badge').forEach(el => el.remove());
    // 展开所有卡片
    document.querySelectorAll('.report-card').forEach(card => card.classList.add('expanded'));
  }

  // 基础版: 部分内容加锁
  if (isBasic) {
    const sections = document.querySelector('.report-sections');
    const allCards = sections.querySelectorAll('.report-card');
    allCards.forEach(card => {
      const title = card.querySelector('.report-card-title h3');
      if (title && title.textContent.includes('日主与性格')) {
        // 性格分析免费版已显示
      }
    });
  }
})();
