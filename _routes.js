export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/bazi')) {
      // Forward to the workers function
      const module = await import('./functions/api/bazi.js');
      return module.default.fetch(request, { CF: { env } });
    }
    // Serve static files
    return fetch(request);
  }
};
