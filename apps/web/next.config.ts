import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// Secrets live in the visible, git-ignored apps/web/env.local, which Next.js does not load by itself.
const envFile = join(process.cwd(), 'env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config: NextConfig = { experimental: { externalDir: true }, poweredByHeader: false };
export default config;
