import { loadEnv } from '@lumora/config';

/** True outside production — used to gate dev-only conveniences (e.g. returning
 * verification tokens in API responses so flows are testable without a mail server). */
export function isDev(): boolean {
  return loadEnv().NODE_ENV !== 'production';
}
