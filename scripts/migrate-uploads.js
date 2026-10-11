import 'dotenv/config';
import mongoose from 'mongoose';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { configureMongoDns, mongoUri, mongoErrorMessage } from '../server/mongo-config.js';
import { detectUpload, uploadPattern, uploadDirectory } from '../server/uploads.js';

// Preserve the existing /uploads URLs; never replace a cloud file or delete a local file.
const deadline = setTimeout(() => {
  console.error(
    'Upload migration timed out. Local files were preserved; rerunning safely resumes.',
  );
  process.exit(1);
}, 120000);
try {
  if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
    const error = new Error(
      'Set MONGODB_URI to your Atlas connection URL before migrating uploads.',
    );
    error.name = 'ConfigurationError';
    throw error;
  }
  configureMongoDns();
  await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 10000 });
  const files = await readdir(uploadDirectory).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  let copied = 0;
  for (const filename of files.filter((name) => uploadPattern.test(name))) {
    const bytes = await readFile(resolve(uploadDirectory, filename));
    if (bytes.length > 4 * 1024 * 1024 || detectUpload(bytes) !== `.${filename.split('.').pop()}`) {
      console.error(`Skipped ${filename}: invalid signature or larger than the Vercel 4 MB limit.`);
      process.exitCode = 1;
      continue;
    }
    const result = await mongoose.connection.db
      .collection('uploads')
      .updateOne(
        { _id: filename },
        { $setOnInsert: { bytes: new mongoose.mongo.Binary(bytes), createdAt: new Date() } },
        { upsert: true, timeoutMS: 10000 },
      );
    copied += result.upsertedCount;
  }
  console.log(
    `Copied ${copied} uploads to Atlas. Existing cloud files and all local files were preserved.`,
  );
} catch (error) {
  console.error(mongoErrorMessage(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  clearTimeout(deadline);
}
