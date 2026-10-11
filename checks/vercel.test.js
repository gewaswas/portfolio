import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const origin = 'https://portfolio-test.vercel.app';
const password = 'isolated-vercel-test-password';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function startInstance(uri, overrides = {}) {
  const child = spawn(process.execPath, ['scripts/test-vercel-server.js'], {
    env: {
      ...process.env,
      VERCEL: '1',
      NODE_ENV: 'production',
      STORAGE_MODE: 'mongodb',
      UPLOAD_STORAGE: 'mongodb',
      MONGODB_URI: uri,
      MONGODB_DNS_SERVERS: '',
      ADMIN_PASSWORD: password,
      PUBLIC_ORIGIN: '',
      VERCEL_URL: 'portfolio-test.vercel.app',
      VERCEL_PROJECT_PRODUCTION_URL: '',
      VERCEL_BRANCH_URL: '',
      ...overrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const ready = new Promise((resolveReady, reject) => {
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const port = output.match(/TEST_PORT=(\d+)/)?.[1];
      if (port) resolveReady(`http://127.0.0.1:${port}`);
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error(`Test instance exited: ${stderr}`)));
  });
  return { child, exited, url: await ready };
}

test('invalid admin passwords return a useful JSON error instead of crashing the function', async () => {
  for (const invalidPassword of ['', 'short']) {
    const instance = await startInstance('mongodb://127.0.0.1:27017/unused', {
      ADMIN_PASSWORD: invalidPassword,
    });
    try {
      const response = await fetch(`${instance.url}/api/index?__route=/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match((await response.json()).error, /ADMIN_PASSWORD.*12–200/);
    } finally {
      instance.child.kill();
      await instance.exited;
    }
  }
});

test(
  'Vercel handler shares sessions, content, uploads and login limits across instances',
  { timeout: 60000 },
  async (t) => {
    await mkdir(resolve('reference'), { recursive: true });
    const mongo = await MongoMemoryServer.create();
    const instances = [];
    try {
      const uri = mongo.getUri('vercel_test');
      instances.push(await startInstance(uri));
      instances.push(await startInstance(uri));
      const [first, second] = instances;
      const call = (instance, path, options = {}) =>
        fetch(`${instance.url}/api/index?__route=${encodeURIComponent(path)}`, {
          ...options,
          signal: AbortSignal.timeout(15000),
        });
      let cookie;
      await t.test(
        'cold starts initialize MongoDB and permit the Vercel deployment origin',
        async () => {
          const healths = await Promise.all(
            instances.map((instance) => call(instance, '/api/health')),
          );
          for (const health of healths) {
            assert.equal(health.status, 200);
            assert.deepEqual(await health.json(), { ok: true, storage: 'mongodb' });
          }
          const denied = await call(first, '/api/auth/login', {
            method: 'POST',
            headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          assert.equal(denied.status, 403);
          const login = await call(first, '/api/auth/login', {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          assert.equal(login.status, 200);
          assert.ok(login.headers.get('set-cookie').includes('Secure'));
          cookie = login.headers.get('set-cookie').split(';')[0];
          const session = await call(second, '/api/auth/session', { headers: { Cookie: cookie } });
          assert.equal(session.status, 200);
          assert.equal((await session.json()).maxUploadBytes, 4 * 1024 * 1024);
        },
      );
      await t.test(
        'content saves persist across instances and stale revisions are rejected',
        async () => {
          const record = await (await call(first, '/api/content')).json();
          record.content.greeting = 'Saved from a Vercel function';
          const update = {
            method: 'PUT',
            headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
          };
          assert.equal((await call(first, '/api/content', update)).status, 200);
          assert.equal(
            (await (await call(second, '/api/content')).json()).content.greeting,
            record.content.greeting,
          );
          assert.equal((await call(second, '/api/content', update)).status, 409);
        },
      );
      await t.test(
        'uploaded images and PDFs are retrieved from MongoDB by another instance',
        async () => {
          for (const [name, type, bytes] of [
            ['image.png', 'image/png', png],
            ['resume.pdf', 'application/pdf', Buffer.from('%PDF-1.7\nTest')],
          ]) {
            const body = new FormData();
            body.append('file', new Blob([bytes], { type }), name);
            const upload = await call(first, '/api/uploads', {
              method: 'POST',
              headers: { Origin: origin, Cookie: cookie },
              body,
            });
            assert.equal(upload.status, 201);
            const { url } = await upload.json();
            const downloaded = await call(second, url);
            assert.equal(downloaded.status, 200);
            assert.equal(downloaded.headers.get('content-type').split(';')[0], type);
            assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
            if (type === 'application/pdf')
              assert.equal(downloaded.headers.get('content-disposition'), 'attachment');
          }
          assert.equal((await call(second, '/uploads/missing.png')).status, 404);
          const body = new FormData();
          body.append('file', new Blob([Buffer.alloc(4 * 1024 * 1024 + 1)]), 'oversized.png');
          assert.equal(
            (
              await call(first, '/api/uploads', {
                method: 'POST',
                headers: { Origin: origin, Cookie: cookie },
                body,
              })
            ).status,
            400,
          );
        },
      );
      await t.test('logout invalidates the session on all instances', async () => {
        assert.equal(
          (
            await call(second, '/api/auth/logout', {
              method: 'POST',
              headers: { Origin: origin, Cookie: cookie },
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(first, '/api/auth/session', { headers: { Cookie: cookie } })).status,
          401,
        );
      });
      await t.test('login limits count requests across instances', async () => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const result = await call(instances[attempt % 2], '/api/auth/login', {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/json',
              'X-Forwarded-For': '192.0.2.10',
            },
            body: JSON.stringify({ password: 'wrong' }),
          });
          assert.equal(result.status, 401);
        }
        const limited = await call(second, '/api/auth/login', {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'X-Forwarded-For': '192.0.2.10',
          },
          body: JSON.stringify({ password }),
        });
        assert.equal(limited.status, 429);
      });
      await t.test('health returns unavailable when MongoDB stops', async () => {
        await mongo.stop();
        assert.equal((await call(first, '/api/health')).status, 503);
      });
    } finally {
      for (const instance of instances) instance.child.kill();
      await Promise.all(instances.map((instance) => instance.exited));
      await mongo.stop();
    }
  },
);
