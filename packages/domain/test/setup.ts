import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Integration-test harness: boots a real (in-memory) MongoDB so services are
 * exercised against genuine MongoDB behavior — indexes, unique constraints,
 * query semantics — without requiring Docker locally (plan Phase 1 verification).
 */

// Prefer a cached/global MongoDB binary and avoid needless re-download checks so
// the suite is not at the mercy of the download host's availability in CI.
process.env.MONGOMS_VERSION ??= '7.0.24';
process.env.MONGOMS_DISABLE_MD5_CHECK ??= '1';

// Env required by loadEnv() must exist before any service calls it.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/lumora-test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.NEXTAUTH_SECRET ??= 'test-secret-value-at-least-16-chars';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.S3_ENDPOINT ??= 'http://localhost:9000';
process.env.S3_BUCKET ??= 'lumora-test';
process.env.S3_ACCESS_KEY_ID ??= 'test';
process.env.S3_SECRET_ACCESS_KEY ??= 'test';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  // Isolate tests: drop all data (and indexes are rebuilt lazily by Mongoose).
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
