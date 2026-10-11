# Deploy the portfolio to Vercel

This repository deploys the React frontend and Express API in one Vercel project. MongoDB Atlas stores portfolio content, uploaded images/PDFs, admin sessions, and login rate limits. No Render backend or separate file-storage account is required.

## 1. Prepare MongoDB Atlas

Use your existing Atlas database: `kbd_portfolio`. The database user in `MONGODB_URI` needs the `readWrite` role on that database, including permission to create indexes. Use the connection URL from your private `.env`, with `/kbd_portfolio` before any query string. Do not put credentials in GitHub.

Open Atlas → **Security → Network Access** and permit connections from Vercel:

- If you have Vercel Static IPs enabled, add those outbound IP addresses to Atlas.
- Without static outbound IPs, Atlas's **Allow Access From Anywhere** option adds `0.0.0.0/0`. This permits network connections from any IP; use a strong database password and a database user restricted to `kbd_portfolio`. Your local computer's IP entry alone does not allow the deployed app to connect.

See [Vercel outbound IP guidance](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address) and [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## 2. Copy your existing uploaded images

Portfolio content is already in Atlas, but files under your local `uploads/` folder are not included in GitHub or Vercel. From this project's PowerShell terminal, run:

```powershell
npm.cmd run db:check
npm.cmd run db:migrate-uploads
```

Keep your existing Atlas `MONGODB_URI` in `.env` while running these commands. The upload migration copies valid files into Atlas under their existing names, so saved `/uploads/...` URLs continue working. It preserves local files and existing cloud files, and is safe to rerun. Files over 4 MB are skipped; compress and re-upload those through the editor after deployment.

Do not run `db:migrate-local` for this deployment: your portfolio is already saved in Atlas. That separate command is for moving content from a local MongoDB database into an empty Atlas database.

## 3. Import GitHub into Vercel

Ensure the deployment preparation changes are pushed to GitHub before importing or redeploying. Then:

1. Sign in at [vercel.com](https://vercel.com/) with GitHub.
2. Select **Add New → Project**.
3. Import **gewaswas/portfolio**. If it is missing, grant Vercel access to this GitHub repository.
4. Use **main** as the production branch and leave **Root Directory** at the repository root.
5. Verify these settings:

| Setting          | Value                  |
| ---------------- | ---------------------- |
| Framework Preset | Vite                   |
| Build Command    | `npm run build`        |
| Output Directory | `dist`                 |
| Install Command  | `npm ci --include=dev` |
| Node.js Version  | `24.x`                 |

The install/build/output settings are included in `vercel.json`; Node.js is specified in `package.json`. The install command includes development dependencies so Vite is installed even with `NODE_ENV=production`. The repository's `.npmrc` also enables them for an existing dashboard override of `npm ci`. Vercel automatically deploys `api/index.js` as the backend function. Do not set `npm start` as the build command.

See [Vite deployment settings](https://vercel.com/docs/frameworks/frontend/vite) and [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 4. Add environment variables

On the import page, open **Environment Variables** and add these individually. Select **Production** for each. Add Preview values only if you want preview deployments to access the database; a separate Atlas database for Preview keeps test edits away from your live portfolio.

| Variable         | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| `MONGODB_URI`    | Your private Atlas URL from `.env`, including `/kbd_portfolio` |
| `ADMIN_PASSWORD` | Your private admin password, 12–200 characters                 |
| `STORAGE_MODE`   | `mongodb`                                                      |
| `UPLOAD_STORAGE` | `mongodb`                                                      |
| `NODE_ENV`       | `production`                                                   |

Do not use `VITE_` prefixes for these secrets. Do not upload `.env`. Do not copy `PORT`, `DATA_DIR`, `UPLOAD_DIR`, or your local DNS override to Vercel. Leave **Automatically expose System Environment Variables** enabled; the API uses Vercel's deployment hostnames to allow login and saves from your site.

`PUBLIC_ORIGIN` is optional for the standard `.vercel.app` address. If you use a custom domain, add it as the exact HTTPS origin, for example `https://www.your-domain.com`, with no path or trailing slash.

Environment changes apply to new deployments. After changing a variable, redeploy. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 5. Deploy and check the live app

Click **Deploy** and wait for the build to finish. Open the production URL shown by Vercel, then:

1. Open `/api/health`. It should return `{"ok":true,"storage":"mongodb"}`.
2. Open `/` and confirm your saved content and images appear.
3. Open `/admin` and sign in using the password you added to Vercel.
4. Make a small edit, save it, and reload to confirm persistence.
5. Upload an image or PDF smaller than 4 MB and confirm it still opens after reloading.

Vercel Functions have a 4.5 MB request/response payload limit. This app uses a 4 MB file limit on Vercel to leave room for multipart headers; local disk uploads retain the 8 MB limit. Larger assets can be hosted elsewhere and entered as HTTPS URLs. See [Vercel Function limits](https://vercel.com/docs/functions/limitations).

After the GitHub integration is enabled, future pushes to `main` trigger production deployments.

## Troubleshooting

| Symptom                                            | What to check                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/api/health` returns 503                          | Vercel Function logs; Atlas network access, database credentials, and the four required database/auth/storage variables    |
| Login/save returns "Request origin is not allowed" | System environment variables are enabled; for a custom domain set `PUBLIC_ORIGIN` to the exact browser origin and redeploy |
| Some uploaded images are missing                   | Run `npm.cmd run db:migrate-uploads` locally against the same Atlas database used on Vercel                                |
| Default content appears instead of your edits      | The deployed connection string must select your existing `kbd_portfolio` database                                          |
| Upload is rejected                                 | Keep files below 4 MB and use PNG, JPEG, WebP, GIF, or PDF                                                                 |
| `/admin` returns 404                               | Use the repository's `vercel.json`, the Vite preset, and `dist` output directory                                           |
| Login returns 429                                  | Wait 15 minutes; the limit is shared across Vercel instances                                                               |

Before pushing later changes, run:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd test
npm.cmd run test:vercel
```

The Vercel tests use a separate temporary MongoDB server and two isolated API instances. They do not change your Atlas database.
