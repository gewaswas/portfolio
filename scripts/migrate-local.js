import 'dotenv/config';
import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { contentSchema } from '../shared/content.js';
import { configureMongoDns } from '../server/mongo-config.js';

let source;
let destination;
try {
  if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
    throw new Error('Configure an Atlas URI in .env before migrating.');
  }
  configureMongoDns();
  source = await mongoose
    .createConnection('mongodb://127.0.0.1:27017/kbd_portfolio', {
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();
  const existing = await source.db.collection('portfolios').findOne({ _id: 'portfolio' });
  if (!existing) throw new Error('No local portfolio record was found.');
  const content = contentSchema.parse(existing.content);
  await mkdir(resolve('data'), { recursive: true });
  const backup = resolve('data', `portfolio-before-atlas-${Date.now()}.json`);
  await writeFile(backup, JSON.stringify(content, null, 2), { flag: 'wx' });
  console.log('Saved a content backup in data/. Uploaded files remain in uploads/.');
  destination = await mongoose
    .createConnection(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .asPromise();
  const result = await destination.db.collection('portfolios').updateOne(
    { _id: 'portfolio' },
    {
      $setOnInsert: {
        content,
        revision: Number.isInteger(existing.revision) ? existing.revision : 1,
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
  console.error(`Migration failed (${error.name}). The local database was left unchanged.`);
  process.exitCode = 1;
} finally {
  await Promise.all([source?.close(), destination?.close()]);
}
