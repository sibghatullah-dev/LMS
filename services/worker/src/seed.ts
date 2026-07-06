import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_INSTITUTION_SLUG, loadEnv } from '@lumora/config';

// Plain Node scripts don't auto-load .env the way Next does — load the repo-root
// .env before anything reads process.env.
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));
} catch {
  /* .env optional: rely on real environment variables */
}
import {
  InstitutionModel,
  UserModel,
  applyJsonSchemaValidators,
  connectToDatabase,
  disconnectFromDatabase,
  hashPassword,
} from '@lumora/domain';

/**
 * Seed the default institution and a Super Admin (FR-ADMIN-04, plan §1.3).
 * Idempotent: safe to re-run. Applies the DB-level $jsonSchema validators
 * (DDD §1.2) first.
 *
 * Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm --filter @lumora/worker seed
 */
async function seed(): Promise<void> {
  loadEnv();
  const conn = await connectToDatabase();
  await applyJsonSchemaValidators(conn.connection);

  const institution =
    (await InstitutionModel.findOne({ slug: DEFAULT_INSTITUTION_SLUG })) ??
    (await InstitutionModel.create({
      name: process.env.SEED_INSTITUTION_NAME ?? 'Lumora',
      slug: DEFAULT_INSTITUTION_SLUG,
      plan: 'enterprise',
    }));
  console.log(`[seed] institution "${institution.slug}" ready (${institution._id})`);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@lumora.local').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await UserModel.findOne({ institutionId: institution._id, email: adminEmail });
  if (existing) {
    existing.fullName = process.env.SEED_ADMIN_NAME ?? existing.fullName ?? 'Platform Admin';
    existing.role = 'super_admin';
    existing.status = 'active';
    existing.emailVerifiedAt = existing.emailVerifiedAt ?? new Date();
    existing.passwordHash = await hashPassword(adminPassword);
    existing.failedLoginAttempts = 0;
    existing.lockedUntil = undefined;
    existing.tokenVersion = (existing.tokenVersion ?? 0) + 1;
    await existing.save();
    console.log(`[seed] super admin ${adminEmail} already exists — reset credentials/status`);
  } else {
    await UserModel.create({
      institutionId: institution._id,
      email: adminEmail,
      fullName: process.env.SEED_ADMIN_NAME ?? 'Platform Admin',
      role: 'super_admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(adminPassword),
    });
    console.log(`[seed] created super admin ${adminEmail}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.warn('[seed] used default password "ChangeMe123!" — change it immediately.');
    }
  }

  await disconnectFromDatabase();
  console.log('[seed] done');
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
