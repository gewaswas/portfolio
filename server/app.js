import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { contentSchema } from '../shared/content.js';
import { initStore, checkStore, getContent, saveContent, storageMode } from './store.js';
import { createSession, hasSession, deleteSession } from './sessions.js';
import { onVercel, uploadStorage, maxUploadBytes, sessionDuration } from './runtime.js';
import { detectUpload, saveUpload, serveMongoUpload, uploadDirectory } from './uploads.js';
import { MongoLoginLimitStore } from './login-limits.js';
const app = express();
const production = onVercel || process.env.NODE_ENV === 'production';
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12 || password.length > 200) {
  const error = new Error(
    'Set ADMIN_PASSWORD to a private password of 12–200 characters and redeploy.',
  );
  error.code = 'ADMIN_PASSWORD_INVALID';
  throw error;
}
const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64);
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: production,
  path: '/api',
  maxAge: sessionDuration,
};
const cookieName = 'kbd_session';
app.disable('x-powered-by');
if (onVercel) app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'http:', 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(['/api', '/uploads'], async (_req, res, next) => {
  try {
    await initStore();
    next();
  } catch (error) {
    console.error(`Storage initialization failed (${error.name}).`);
    res
      .status(503)
      .json({ error: 'Portfolio storage is unavailable. Check deployment database settings.' });
  }
});
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const allowed = new Set([process.env.PUBLIC_ORIGIN]);
    if (onVercel) {
      for (const hostname of [
        process.env.VERCEL_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_BRANCH_URL,
      ]) {
        if (hostname) allowed.add(`https://${hostname}`);
      }
    }
    if (!production)
      [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
      ].forEach((v) => allowed.add(v));
    if (!origin || !allowed.has(origin))
      return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  next();
});
async function auth(req, res, next) {
  const raw = req.headers.cookie?.split(';').find((v) => v.trim().startsWith(`${cookieName}=`));
  const token = raw?.trim().slice(cookieName.length + 1);
  if (!(await hasSession(token))) {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  req.sessionToken = token;
  next();
}
const loginLimiter = rateLimit({
  ...(storageMode === 'mongodb' ? { store: new MongoLoginLimitStore() } : {}),
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const input = req.body?.password;
  if (
    typeof input !== 'string' ||
    input.length > 200 ||
    !timingSafeEqual(scryptSync(input, salt, 64), passwordHash)
  )
    return res.status(401).json({ error: 'Incorrect password.' });
  const token = randomBytes(32).toString('hex');
  await createSession(token);
  res.cookie(cookieName, token, cookieOptions).json({ ok: true });
});
app.get('/api/auth/session', auth, (_req, res) =>
  res.json({ ok: true, storage: storageMode, maxUploadBytes }),
);
app.post('/api/auth/logout', auth, async (req, res) => {
  await deleteSession(req.sessionToken);
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(cookieName, clearOptions).json({ ok: true });
});
app.get('/api/health', async (_req, res) => {
  try {
    await checkStore();
    res.json({ ok: true, storage: storageMode });
  } catch {
    res
      .status(503)
      .json({ ok: false, storage: storageMode, error: 'Portfolio storage is unavailable.' });
  }
});
app.get('/api/content', async (_req, res) => res.json(await getContent()));
app.put('/api/content', auth, async (req, res) => {
  const parsed = contentSchema.safeParse(req.body?.content);
  if (!parsed.success || !Number.isSafeInteger(req.body?.revision) || req.body.revision < 1)
    return res.status(400).json({ error: 'Content is invalid.', details: parsed.error?.issues });
  const record = await saveContent(parsed.data, req.body.revision);
  if (!record)
    return res
      .status(409)
      .json({ error: 'Another editor saved changes. Reload before saving again.' });
  res.json(record);
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1 },
});
app.post('/api/uploads', auth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Choose an image or PDF.' });
  const b = file.buffer;
  const extension = detectUpload(b);
  if (!extension)
    return res
      .status(400)
      .json({ error: 'Only PNG, JPEG, WebP, GIF, and PDF files are supported.' });
  const name = `${randomBytes(16).toString('hex')}${extension}`;
  await saveUpload(name, b);
  res.status(201).json({ url: `/uploads/${name}` });
});
if (uploadStorage === 'mongodb') app.get('/uploads/:filename', serveMongoUpload);
else
  app.use(
    '/uploads',
    express.static(uploadDirectory, {
      setHeaders: (res, file) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (extname(file) === '.pdf') res.setHeader('Content-Disposition', 'attachment');
      },
    }),
  );
app.get('/api/assets', auth, async (_req, res) => {
  const [root, nested] = await Promise.all([
    readdir(resolve('public')).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    }),
    readdir(resolve('public/assets')).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    }),
  ]);
  const isImage = (f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f) && f !== 'favicon.svg';
  res.json([
    ...root.filter(isImage).map((f) => `/${f}`),
    ...nested.filter(isImage).map((f) => `/assets/${f}`),
  ]);
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
if (!onVercel && existsSync(resolve('dist/index.html'))) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
}
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      error:
        error.code === 'LIMIT_FILE_SIZE'
          ? `File must be under ${maxUploadBytes / 1024 / 1024} MB.`
          : 'Upload failed.',
    });
  console.error(error.message);
  res.status(error.status === 413 ? 413 : 500).json({
    error:
      error.status === 413 ? 'Content is too large.' : 'Something went wrong. Please try again.',
  });
});
export default app;
