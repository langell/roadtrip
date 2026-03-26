import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withBundleAnalyzer =
  () =>
  (config = {}) =>
    config;

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@roadtrip/ui'],
  webpack: (cfg) => {
    cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false };
    return cfg;
  },
};

export default withBundleAnalyzer()(config);
