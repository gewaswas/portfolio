import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { contentSchema } from '../shared/content.js';
import { configureMongoDns, mongoUri, mongoErrorMessage } from '../server/mongo-config.js';

let source;
let destination;
const deadline = setTimeout(() => {
  console.error(
    'Migration timed out. Check MongoDB DNS and network access. The local database was left unchanged.',
  );
  process.exit(1);
}, 30000);
try {
  if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
    const error = new Error('Configure an Atlas URI in .env before migrating.');
    error.name = 'ConfigurationError';
    throw error;
  }
  configureMongoDns();
  source = mongoose.createConnection('mongodb://127.0.0.1:27017/kbd_portfolio', {
    serverSelectionTimeoutMS: 5000,
  });
  await source.asPromise();
  const existing = await source.db.collection('portfolios').findOne({ _id: 'portfolio' });
  if (!existing) {
    const error = new Error(
      'No local portfolio record was found. Start the local database containing your edits first.',
    );
    error.name = 'ConfigurationError';
    throw error;
  }
  const content = contentSchema.parse(existing.content);
  await mkdir(resolve('data'), { recursive: true });
  const backup = resolve('data', `portfolio-before-atlas-${Date.now()}.json`);
  await writeFile(backup, JSON.stringify(content, null, 2), { flag: 'wx' });
  console.log('Saved a content backup in data/. Uploaded files remain in uploads/.');
  destination = mongoose.createConnection(mongoUri(), { serverSelectionTimeoutMS: 10000 });
  await destination.asPromise();
  const result = await destination.db.collection('portfolios').updateOne(
    { _id: 'portfolio' },
    {
      $setOnInsert: {
        content,
        revision:
          Number.isSafeInteger(existing.revision) && existing.revision > 0 ? existing.revision : 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log(
    result.upsertedCount
      ? 'Copied the saved local portfolio to Atlas.'
      : 'Atlas already contains a portfolio. Existing cloud content was preserved.',
  );
} catch (error) {
  console.error(
    `Migration failed: ${mongoErrorMessage(error)} The local database was left unchanged.`,
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source?.close(), destination?.close()]);
  clearTimeout(deadline);
}
