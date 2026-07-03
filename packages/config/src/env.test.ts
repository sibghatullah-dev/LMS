import { afterEach, describe, expect, it } from 'vitest';
import { __resetEnvForTests, loadEnv } from './env';

const base = {
  MONGODB_URI: 'mongodb://localhost:27017/lumora',
  REDIS_URL: 'redis://localhost:6379',
  NEXTAUTH_SECRET: 'a-sufficiently-long-secret',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'lumora-local',
  S3_ACCESS_KEY_ID: 'lumora',
  S3_SECRET_ACCESS_KEY: 'lumora-secret',
};

afterEach(() => __resetEnvForTests());

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(base as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_BASE_PATH).toBe('/api/v1');
    expect(env.ACCESS_TOKEN_TTL_MIN).toBe(15);
    expect(env.MAX_VIDEO_UPLOAD_BYTES).toBe(2_147_483_648);
  });

  it('fails fast when a required variable is missing', () => {
    const { MONGODB_URI: _omit, ...missing } = base;
    __resetEnvForTests();
    expect(() => loadEnv(missing as NodeJS.ProcessEnv)).toThrow(/MONGODB_URI/);
  });
});
