# KBD. Portfolio

An editable portfolio built with **MongoDB, Express, React, and Node.js**. The public design follows the supplied black-and-white KBD screenshots: circular portraits, about section, three project logos, percentage rings, alternating software cards, and contact/footer. The video informs the name typewriter, looping Programming/Cybersecurity text, progress rings, and software screenshot/icon crossfade.

## Run locally

Use Node.js 24.x (the same version configured for Vercel).

```powershell
npm install
npm run setup
npm run dev
```

- Portfolio: http://127.0.0.1:5173
- Editor: http://127.0.0.1:5173/admin
- Find your generated `ADMIN_PASSWORD` in `.env`. Change it there if you prefer another password of at least 12 characters, then restart the server.

`npm run dev` starts Express on port 4000 and Vite on port 5173. With a local MongoDB URI, it also starts a local MongoDB server on `127.0.0.1:27017`; with Atlas or another external URI, it skips the local database process. The MongoDB runner uses a real `mongod` process with WiredTiger and saves data in `data/mongodb`; it preserves that folder on shutdown. It is a development convenience, not a production database service. Its first installation downloads a MongoDB binary.

If MongoDB already runs locally, or you use Atlas, set `MONGODB_URI` in `.env` and run `npm run dev:external-db`. Keep `STORAGE_MODE=mongodb`.

For Atlas, include `/kbd_portfolio` in the connection URL and use your Atlas database credentials. Run `npm run db:check` to verify the connection. If your network refuses Atlas DNS SRV lookups, the optional `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` setting uses those resolvers for this app without changing Windows settings.

To transfer local edits to an empty Atlas database, keep the local MongoDB process running, configure the Atlas URL in `.env`, and run `npm run db:migrate-local` before starting the app against Atlas. This saves a JSON content backup in `data/` and inserts the local portfolio only when the cloud record is absent. It never overwrites an existing cloud portfolio or deletes local data. Keep `uploads/` for image files.

An explicit offline development fallback is `STORAGE_MODE=file`, which saves `data/portfolio.json`. The default is MongoDB; the app never silently falls back from a failed database connection.

## Edit the portfolio

Sign in at `/admin`. Edit your profile, portraits, about text, projects and links, skill names and percentages, software images, email/social links, optional résumé, and animation settings. Add, delete, or reorder projects, skills, and software. Use **Preview** to inspect your draft, then **Save changes** to publish it locally. Edits persist in MongoDB and are loaded by the public site. Concurrent edits are checked by revision to prevent overwriting another editor’s save.

Image fields accept uploads (PNG/JPEG/WebP/GIF, up to 8 MB), existing local images, or public HTTPS image URLs. Résumé accepts PDF. Local images in `public` and `public/assets` appear in the editor’s dropdown. Uploaded files are stored in `uploads`. Back up that folder as well as your database. Export/import JSON backs up content, not image bytes.

The Instagram and GitHub profile links and project Live/Source links appear after their actual URLs are entered. Edit your GitHub profile URL under **Contact** in the editor. No invented social profile or project destination is used. Project cards open an accessible details dialog even without external URLs. Project descriptions are editable starter copy. Verify the email against your own address.

## Files

- `src/Portfolio.jsx`: public layout and components.
- `src/animations.js`: typing, visibility, and reduced-motion behavior.
- `src/Admin.jsx`: password-protected editor and draft preview.
- `src/styles.css`: responsive portfolio and editor styles.
- `shared/content.js`: initial content and shared validation schema.
- `server/app.js`: API, authentication, uploads, and production static serving.
- `server/index.js`: local server startup; `api/index.js` exports the Vercel handler.
- `server/store.js`: MongoDB persistence and optional file development storage.
- `scripts/mongo.js`: persistent local development MongoDB runner.

Initial defaults only seed an empty database. After the first run, update content through `/admin` rather than changing defaults and expecting existing edits to reset.

## Verification

```powershell
npm run check
npm run build
npm run db:check
npm test
npm run test:vercel
```

Browser tests use headless Microsoft Edge on Windows. Change the Playwright `channel` to your installed browser on another platform. Tests check rendering, mobile navigation, reduced motion, login and request-origin guards, editor save/reload, uploads, invalid content, and revision conflicts. They start an isolated app on ports 5174 and 4100 using test-only file storage and credentials; they do not write to your Atlas database or use your real admin password. Test data, test uploads, and screenshots go in ignored `reference/`.

## Production

For Vercel, follow [DEPLOYMENT.md](DEPLOYMENT.md). The frontend and API deploy together; Atlas stores content, uploads, sessions, and shared login limits. The Vercel upload limit is 4 MB. Copy existing local uploads with `npm run db:migrate-uploads` before deploying.

Set `NODE_ENV=production`, `STORAGE_MODE=mongodb`, your production `MONGODB_URI`, a strong private `ADMIN_PASSWORD`, and `PUBLIC_ORIGIN` to the website’s exact HTTPS origin. Run `npm run build`, then `npm start`. Express serves the built React app and API together; place it behind an HTTPS reverse proxy. Use a managed MongoDB service or a properly operated MongoDB instance. Do not use the development runner for hosting.

Session cookies are HTTP-only and expire after eight hours. MongoDB sessions and login limits persist across API instances; file-storage development sessions stay in memory. Writes require an allowed request origin and authenticated session, and uploads use file signatures and random filenames. Save `.env` privately and never commit it. With disk uploads, preserve the database and `uploads` across deployments; with MongoDB uploads, back up Atlas.
