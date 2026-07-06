import mongoose from 'mongoose';
import { loadEnv } from '@lumora/config';

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

/**
 * Mongoose connection singleton (DDD §1, SAD §4.6).
 *
 * Next.js hot-reloads modules in dev, which would otherwise open a new pool on
 * every reload. We cache the connection promise on `globalThis` so there is
 * exactly one pool per process across reloads.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as unknown as { __lumoraMongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose.__lumoraMongoose ?? { conn: null, promise: null };
globalForMongoose.__lumoraMongoose = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (cache.conn && mongoose.connection.readyState !== 1) {
    cache.conn = null;
    cache.promise = null;
  }
  if (!cache.promise) {
    const { MONGODB_URI } = loadEnv();
    cache.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3_000,
      heartbeatFrequencyMS: 10_000,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    cache.conn = null;
    throw err;
  }
  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
