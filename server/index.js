import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { contentSchema } from '../shared/content.js';
import { initStore, getContent, saveContent, storageMode } from './store.js';
const app = express();
const production = process.env.NODE_ENV === 'production';
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    'Set an ADMIN_PASSWORD with at least 12 characters in .env. Run npm run setup first.',
  );
const salt = randomBytes(16);
const passwordHash = scryptSync(password, salt, 64);
const sessions = new Map();
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: production,
  path: '/api',
  maxAge: 8 * 60 * 60 * 1000,
};
const cookieName = 'kbd_session';
app.disable('x-powered-by');
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
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const allowed = new Set([process.env.PUBLIC_ORIGIN]);
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
function auth(req, res, next) {
  const raw = req.headers.cookie?.split(';').find((v) => v.trim().startsWith(`${cookieName}=`));
  const token = raw?.trim().slice(cookieName.length + 1);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  req.sessionToken = token;
  next();
}
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
setInterval(() => {
  for (const [token, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(token);
  }
}, 60 * 1000).unref();
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const input = req.body?.password;
  if (
    typeof input !== 'string' ||
    input.length > 200 ||
    !timingSafeEqual(scryptSync(input, salt, 64), passwordHash)
  )
    return res.status(401).json({ error: 'Incorrect password.' });
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + cookieOptions.maxAge });
  res.cookie(cookieName, token, cookieOptions).json({ ok: true });
});
app.get('/api/auth/session', auth, (_req, res) => res.json({ ok: true, storage: storageMode }));
app.post('/api/auth/logout', auth, (req, res) => {
  sessions.delete(req.sessionToken);
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(cookieName, clearOptions).json({ ok: true });
});
app.get('/api/health', (_req, res) => res.json({ ok: true, storage: storageMode }));
app.get('/api/content', async (_req, res) => res.json(await getContent()));
app.put('/api/content', auth, async (req, res) => {
  const parsed = contentSchema.safeParse(req.body?.content);
  if (!parsed.success || !Number.isInteger(req.body?.revision) || req.body.revision < 1)
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
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});
const uploadDirectory = resolve(process.env.UPLOAD_DIR || 'uploads');
await mkdir(uploadDirectory, { recursive: true });
function detectUpload(buffer) {
  if (
    buffer.length > 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return '.png';
  if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return '.jpg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return '.webp';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return '.gif';
  if (buffer.subarray(0, 5).toString() === '%PDF-') return '.pdf';
  return null;
}
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
  await writeFile(resolve(uploadDirectory, name), b, { flag: 'wx' });
  res.status(201).json({ url: `/uploads/${name}` });
});
app.use(
  '/uploads',
  express.static(resolve(process.env.UPLOAD_DIR || 'uploads'), {
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
if (existsSync(resolve('dist/index.html'))) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
}
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'File must be under 8 MB.' : 'Upload failed.',
    });
  console.error(error.message);
  res.status(error.status === 413 ? 413 : 500).json({
    error:
      error.status === 413 ? 'Content is too large.' : 'Something went wrong. Please try again.',
  });
});
try {
  await initStore();
  app.listen(process.env.PORT || 4000, '0.0.0.0', () =>
    console.log(`Portfolio API ready at http://localhost:${process.env.PORT || 4000}`),
  );
} catch (error) {
  console.error(`Cannot connect to the database (${error.name}). Check your database settings.`);
  process.exit(1);
}
