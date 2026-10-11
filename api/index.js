let appPromise;

export default async function handler(req, res) {
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
  try {
    appPromise ??= import('../server/app.js');
    const { default: app } = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error(`API startup failed (${error.code || error.name}).`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        error:
          error.code === 'ADMIN_PASSWORD_INVALID'
            ? 'Set ADMIN_PASSWORD to a private password of 12–200 characters in Vercel and redeploy.'
            : 'The API could not start. Check the Vercel function logs and deployment configuration.',
      }),
    );
  }
}
