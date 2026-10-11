import app from '../server/app.js';

export default function handler(req, res) {
  // Reconstruct Express's path explicitly when Vercel rewrites to this function.
  const url = new URL(req.url, 'http://localhost');
  const route = req.query?.__route ?? url.searchParams.get('__route');
  if (route !== undefined && route !== null) {
    if (
      typeof route !== 'string' ||
      !/^\/(?:api|uploads)(?:\/|$)/.test(route) ||
      /[?#]/.test(route)
    ) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Route not found.' }));
      return;
    }
    url.searchParams.delete('__route');
    const query = url.searchParams.toString();
    req.url = `${route}${query ? `?${query}` : ''}`;
  }
  return app(req, res);
}
