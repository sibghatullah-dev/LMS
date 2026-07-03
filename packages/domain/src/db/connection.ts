import mongoose from 'mongoose';
import { loadEnv } from '@lumora/config';

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
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const { MONGODB_URI } = loadEnv();
    mongoose.set('strictQuery', true);
    cache.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
