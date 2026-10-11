import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { storageMode } from './store.js';
import { sessionDuration } from './runtime.js';

const sessions = new Map();
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export async function createSession(token) {
  const expiresAt = new Date(Date.now() + sessionDuration);
  if (storageMode === 'mongodb') {
    await mongoose.connection.db
      .collection('admin_sessions')
      .insertOne({ _id: tokenHash(token), expiresAt });
  } else sessions.set(tokenHash(token), { expiresAt });
}
export async function hasSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session =
    storageMode === 'mongodb'
      ? await mongoose.connection.db
          .collection('admin_sessions')
          .findOne({ _id: tokenHash(token), expiresAt: { $gt: new Date() } })
      : sessions.get(tokenHash(token));
  if (!session || session.expiresAt <= new Date()) {
    if (session) await deleteSession(token);
    return false;
  }
  return true;
}
export async function deleteSession(token) {
  if (storageMode === 'mongodb')
    await mongoose.connection.db.collection('admin_sessions').deleteOne({ _id: tokenHash(token) });
  else sessions.delete(tokenHash(token));
}
