/**
 * Cloudflare Pages Function - 客服反馈处理
 * POST /api/contact
 * 
 * 通过 Server酱 推送反馈到创始人微信
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, contact, message, time } = body;

    if (!name || !message) {
      return new Response(JSON.stringify({ error: '姓名和反馈内容为必填项' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: '反馈内容过长' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 通过 Server酱 推送到微信
    const sctKey = env.SCT_KEY;
    if (sctKey) {
      const title = `📨 道器命理 · ${name} 的反馈`;
      const content = `## ${name} 发来新反馈\n\n**联系方式：** ${contact || '未留'}\n**时间：** ${time || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n> ${message}`;

      await fetch(`https://sctapi.ftqq.com/${sctKey}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, desp: content })
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Contact error:', err);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
