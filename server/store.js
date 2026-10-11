import mongoose from 'mongoose';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defaultContent, contentSchema } from '../shared/content.js';
import { configureMongoDns, mongoUri } from './mongo-config.js';
import { onVercel, uploadStorage } from './runtime.js';
const filename = resolve(process.env.DATA_DIR || 'data', 'portfolio.json');
const schema = new mongoose.Schema(
  { _id: String, content: mongoose.Schema.Types.Mixed, revision: Number },
  { timestamps: true },
);
const Portfolio = mongoose.model('Portfolio', schema);
let fileQueue = Promise.resolve();
let record;
export const storageMode = process.env.STORAGE_MODE || 'mongodb';
let initialization;
export function initStore() {
  initialization ??= initializeStore().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
async function initializeStore() {
  if (
    onVercel &&
    (storageMode !== 'mongodb' || uploadStorage !== 'mongodb' || !process.env.MONGODB_URI)
  ) {
    throw new Error(
      'Vercel requires MONGODB_URI, STORAGE_MODE=mongodb and UPLOAD_STORAGE=mongodb.',
    );
  }
  if (
    !['disk', 'mongodb'].includes(uploadStorage) ||
    (uploadStorage === 'mongodb' && storageMode !== 'mongodb')
  ) {
    throw new Error(
      'MongoDB uploads require MongoDB content storage. UPLOAD_STORAGE must be disk or mongodb.',
    );
  }
  if (storageMode === 'mongodb') {
    configureMongoDns();
    await mongoose.connect(mongoUri(), {
      serverSelectionTimeoutMS: onVercel ? 10000 : 60000,
      maxPoolSize: 5,
      bufferCommands: false,
    });
    await Portfolio.updateOne(
      { _id: 'portfolio' },
      { $setOnInsert: { content: defaultContent, revision: 1 } },
      { upsert: true },
    );
    await mongoose.connection.db
      .collection('admin_sessions')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await mongoose.connection.db
      .collection('login_limits')
      .createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 });
  } else if (storageMode === 'file') {
    await mkdir(resolve(process.env.DATA_DIR || 'data'), { recursive: true });
    try {
      record = JSON.parse(await readFile(filename, 'utf8'));
      contentSchema.parse(record.content);
      if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
        throw new Error('Stored portfolio revision must be a positive safe integer.');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      record = { content: defaultContent, revision: 1 };
      await persist(record);
    }
    console.log('Local file storage enabled. Set STORAGE_MODE=mongodb to use MongoDB.');
  } else throw new Error('STORAGE_MODE must be file or mongodb');
}
export async function checkStore() {
  if (storageMode === 'mongodb') {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB is disconnected.');
    await mongoose.connection.db.admin().ping({ timeoutMS: 3000 });
  }
  return getContent();
}
async function persist(value) {
  await writeFile(`${filename}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${filename}.tmp`, filename);
}
export async function getContent() {
  if (storageMode === 'mongodb') {
    const doc = await Portfolio.findById('portfolio').lean();
    return { content: contentSchema.parse(doc.content), revision: doc.revision };
  }
  return {
    content: contentSchema.parse(structuredClone(record.content)),
    revision: record.revision,
  };
}
export async function saveContent(content, revision) {
  if (storageMode === 'mongodb') {
    const doc = await Portfolio.findOneAndUpdate(
      { _id: 'portfolio', revision },
      { $set: { content }, $inc: { revision: 1 } },
      { returnDocument: 'after' },
    ).lean();
    return doc ? { content: doc.content, revision: doc.revision } : null;
  }
  const work = fileQueue.then(async () => {
    if (record.revision !== revision) return null;
    const next = { content, revision: revision + 1 };
    await persist(next);
    record = next;
    return structuredClone(record);
  });
  fileQueue = work.catch(() => {});
  return work;
}
