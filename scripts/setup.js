import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (existsSync('.env')) console.log('Existing .env preserved. Set ADMIN_PASSWORD there if needed.');
else {
  writeFileSync(
    '.env',
    readFileSync('.env.example', 'utf8').replace(
      'ADMIN_PASSWORD=',
      `ADMIN_PASSWORD=${randomBytes(18).toString('base64url')}`,
    ),
    { mode: 0o600 },
  );
  console.log('Created .env. Your private admin password is in that file.');
}
