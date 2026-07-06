import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The single source-of-truth .env lives at the monorepo root; Next only looks in
// the app dir by default, so load the root file at server boot (dev + start).
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));
} catch {
  /* .env optional: fall back to the real environment (cloud/CI) */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source; Next transpiles them.
  transpilePackages: ['@lumora/config', '@lumora/domain'],
  // Server-only DB packages: keep them (and the driver's optional native deps)
  // out of the bundle so route handlers require them at runtime (Next 15).
  serverExternalPackages: ['mongoose', 'mongodb', 'bcryptjs'],
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // Optional MongoDB driver dependency for AWS IAM auth. Lumora local/dev
      // does not use it; aliasing prevents noisy dev-server warnings.
      aws4: false,
    };
    return config;
  },
  // Linting runs as a dedicated root step (`pnpm lint`) in CI; skip the
  // redundant in-build pass (which also expects eslint-config-next).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
