import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Secrets live in the visible, git-ignored apps/web/env.local, which Next.js does not load by itself.
const envFile = join(process.cwd(), 'env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
// Off Vercel, the app runs as the loopback-only local demo. Set here (not in package scripts) so Windows, macOS and Linux behave the same.
if (!process.env.VERCEL && !process.env.SAATHI_LOCAL_DEMO) process.env.SAATHI_LOCAL_DEMO = '1';
// The app imports the shared packages from the repository root; the evaluation results are read at runtime.
const config: NextConfig = {
  experimental: { externalDir: true },
  poweredByHeader: false,
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  outputFileTracingIncludes: { '/api/evaluation': ['../../output/evaluation/*.json'] },
};
export default config;
