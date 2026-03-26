const allowModules = [
  'react-native',
  '@react-native',
  '@react-native/js-polyfills',
  'expo(nent)?',
  '@expo',
  '@unimodules',
  'unimodules',
  'sentry-expo',
  'native-base',
  '@sentry',
  'zustand',
].join('|');

module.exports = {
  preset: 'react-native',
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transformIgnorePatterns: [
    `node_modules/(?!((?:\\.pnpm/[^/]+/node_modules/)?(${allowModules}))/)`,
  ],
};
