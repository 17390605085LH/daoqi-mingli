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

  // 等待动态内容渲染完成
  function applyTierRules() {
    const header = document.querySelector('.report-header');
    if (!header) return;

    // 添加 tier 标记
    const existingBadge = document.querySelector('.report-tier-badge');
    if (!existingBadge) {
      const badge = document.createElement('div');
      const tierName = isFree ? '免费体验版' : plan;
      const tierColor = isFree ? 'var(--color-text-muted)' : 'var(--color-gold)';
      badge.style.cssText = `display:inline-block;padding:0.25rem 1rem;border-radius:100px;font-size:0.8rem;font-weight:600;margin-bottom:1rem;background:${tierColor}15;color:${tierColor};border:1px solid ${tierColor}30;`;
      badge.textContent = tierName;
      header.insertBefore(badge, header.firstChild);
    }

    // 付费版：移除所有锁，展开全部卡片
    if (!isFree) {
      document.querySelectorAll('.lock-overlay').forEach(el => el.remove());
      document.querySelectorAll('.lock-badge').forEach(el => el.remove());
      document.querySelectorAll('.report-card').forEach(card => card.classList.add('expanded'));
    }
  }

  // 使用 MutationObserver 等待内容加载
  const observer = new MutationObserver(function(mutations) {
    const cards = document.querySelector('.report-sections .report-card');
    if (cards) {
      observer.disconnect();
      applyTierRules();
    }
  });
  observer.observe(document.querySelector('.report-sections') || document.body, {
    childList: true, subtree: true
  });

  // 兜底：2秒后强制执行
  setTimeout(applyTierRules, 2000);
})();
