export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API route - handle CORS preflight
    if (url.pathname === '/api/bazi') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      const name = url.searchParams.get('name') || '';
      const gender = url.searchParams.get('gender') || '';
      const year = url.searchParams.get('year') || '';
      const month = url.searchParams.get('month') || '';
      const day = url.searchParams.get('day') || '';
      const hour = url.searchParams.get('hour') || '';
      const calendar = url.searchParams.get('calendar') || 'solar';

      const module = await import('./functions/api/bazi.js');
      return module.default.fetch(request, { CF: { env }, env });
    }

    // Serve static files from dist
    const pathname = url.pathname === '/' ? '/form.html' : url.pathname;
    try {
      const file = await env.ASSETS.fetch(new Request(url.origin + pathname));
      if (file.ok) return file;

      // Fallback: serve from current directory
      const fs = await import('fs');
      const filePath = pathname.slice(1);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        const ext = filePath.split('.').pop();
        const types = { html: 'text/html', js: 'application/javascript', css: 'text/css' };
        return new Response(content, {
          headers: { 'Content-Type': types[ext] || 'text/plain' },
        });
      }
    } catch (e) {}

    // 404
    return new Response('Not Found', { status: 404 });
  },
};