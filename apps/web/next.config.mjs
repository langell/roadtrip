import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const withBundleAnalyzer = () => (config = {}) => config;

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ['@roadtrip/ui'],
  webpack: (cfg) => {
    cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false };
    return cfg;
  }
};

export default withBundleAnalyzer()(config);
