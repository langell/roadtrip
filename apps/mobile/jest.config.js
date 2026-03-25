module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:react-native|@react-native|expo(nent)?|@expo|@unimodules|unimodules|sentry-expo|native-base|@sentry|zustand)/)'
  ]
};
