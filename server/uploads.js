import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { uploadStorage } from './runtime.js';

export const uploadDirectory = resolve(process.env.UPLOAD_DIR || 'uploads');
export const uploadPattern = /^[a-f0-9]{32}\.(?:png|jpg|webp|gif|pdf)$/;
const mimeTypes = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

export function detectUpload(buffer) {
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
export async function saveUpload(name, bytes) {
  if (uploadStorage === 'mongodb') {
    await mongoose.connection.db
      .collection('uploads')
      .insertOne({ _id: name, bytes: new mongoose.mongo.Binary(bytes), createdAt: new Date() });
  } else {
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(resolve(uploadDirectory, name), bytes, { flag: 'wx' });
  }
}
export async function serveMongoUpload(req, res) {
  const name = req.params.filename;
  if (!uploadPattern.test(name)) return res.status(404).end();
  const file = await mongoose.connection.db.collection('uploads').findOne({ _id: name });
  if (!file) return res.status(404).end();
  // Earlier uploads used a Mongoose Buffer field named data; preserve their URLs.
  const binary = file.bytes ?? file.data;
  const bytes = Buffer.isBuffer(binary)
    ? binary
    : binary instanceof Uint8Array
      ? Buffer.from(binary)
      : typeof binary?.value === 'function'
        ? Buffer.from(binary.value())
        : null;
  if (!bytes) return res.status(404).end();
  res.setHeader('Content-Type', mimeTypes[name.split('.').pop()]);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (name.endsWith('.pdf')) res.setHeader('Content-Disposition', 'attachment');
  res.send(bytes);
}
