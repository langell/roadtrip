import path from 'path';
import { fileURLToPath } from 'url';

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
  turbopack: {},
};

export default withBundleAnalyzer()(config);
