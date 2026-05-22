/**
 * Cloudflare Pages Function - 客服反馈处理
 * POST /api/contact
 * 
 * 功能：
 * 1. 接收用户反馈
 * 2. 存储到 Cloudflare KV
 * 3. 通过企业微信 Webhook 推送给创始人
 */

// 企业微信机器人 Webhook URL（需在 Cloudflare Pages 环境变量中配置）
const WECOM_WEBHOOK_URL = WECOM_WEBHOOK_URL || '';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, contact, message, time } = body;

    // 基本验证
    if (!name || !message) {
      return new Response(JSON.stringify({ error: '姓名和反馈内容为必填项' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 防止 spam
    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: '反馈内容过长（限2000字）' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 存储到 KV
    const timestamp = Date.now();
    const id = `msg_${timestamp}`;
    
    if (env.CONTACT_KV) {
      await env.CONTACT_KV.put(id, JSON.stringify({
        id,
        name: name.substring(0, 50),
        contact: (contact || '').substring(0, 100),
        message: message.substring(0, 2000),
        time: time || new Date().toISOString(),
        ip: request.headers.get('cf-connecting-ip') || 'unknown'
      }));
    }

    // 推送到企业微信
    if (env.WECOM_WEBHOOK_URL || WECOM_WEBHOOK_URL) {
      const webhookUrl = env.WECOM_WEBHOOK_URL || WECOM_WEBHOOK_URL;
      const wecomMessage = {
        msgtype: 'markdown',
        markdown: {
          content: `## 📨 道器命理 · 新客户反馈\n\n**称呼：** ${name}\n**联系方式：** ${contact || '未留'}\n**时间：** ${time || new Date().toLocaleString('zh-CN')}\n\n> ${message}\n\n---\n[道器命理 · 数字客服](https://daoqi-mingli.pages.dev)`
        }
      };

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(wecomMessage)
        });
      } catch (wecomErr) {
        console.error('WeCom webhook failed:', wecomErr);
        // 不阻断用户流程，静默失败
      }
    }

    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Contact API error:', err);
    return new Response(JSON.stringify({ error: '服务器错误，请稍后重试' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理 OPTIONS 预检请求（CORS）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
