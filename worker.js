import { onRequestGet, onRequestOptions } from './functions/api/bazi.js';

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // API 路由
      if (url.pathname === '/api/bazi') {
        if (request.method === 'OPTIONS') {
          return onRequestOptions({ request, env, context: { waitUntil: () => {} } });
        } else {
          return onRequestGet({ request, env, context: { waitUntil: () => {} } });
        }
      }

      // 正确交给 wrangler assets 分发静态资源
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }

      // 若 assets 不可用，则直接返回404
      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: '请求处理失败: ' + err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
