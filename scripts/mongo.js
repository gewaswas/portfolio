import 'dotenv/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// Despite the package name, wiredTiger + an explicit dbPath persist edits on disk.
// This runner is for local development; production uses a managed MongoDB service.
if (process.env.STORAGE_MODE === 'file') {
  console.log('File storage selected; local MongoDB is not needed.');
  setInterval(() => {}, 2147483647);
} else {
  const dbPath = resolve(process.env.MONGO_DATA_DIR || 'data/mongodb');
  await mkdir(dbPath, { recursive: true });
  const mongo = new MongoMemoryServer({
    instance: {
      port: Number(process.env.MONGO_PORT || 27017),
      ip: '127.0.0.1',
      dbPath,
      storageEngine: 'wiredTiger',
    },
  });
  try {
    await mongo.start(true);
    console.log(`Local MongoDB ready on port ${mongo.instanceInfo.port}. Data: ${dbPath}`);
    const stop = async () => {
      await mongo.stop({ doCleanup: false, force: false });
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(
      `Local MongoDB could not start: ${error.message}. If MongoDB already runs, use npm run dev:external-db.`,
    );
    process.exit(1);
  }
}
