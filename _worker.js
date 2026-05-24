export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API route
    if (url.pathname.startsWith('/api/bazi')) {
      const module = await import('./functions/api/bazi.js');
      return module.default.fetch(request, { CF: { env }, env });
    }
    
    // Serve static files from current directory
    return env.ASSETS.fetch(request);
  }
};
