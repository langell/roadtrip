import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const repoRoot = new URL('../../..', import.meta.url);
const workspaceNodeModules = fileURLToPath(new URL('node_modules', repoRoot));

export default [
  js.configs.recommended,
  {
    ignores: [
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/*.config.ts',
      'apps/mobile/expo-entry.js'
    ]
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/dist/**', '**/.next/**', '**/build/**', '**/.expo/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
        project: [
          'tsconfig.json',
          'apps/*/tsconfig.json',
          'apps/*/tsconfig.eslint.json',
          'packages/*/tsconfig.json',
          'packages/*/tsconfig.eslint.json'
        ],
        tsconfigRootDir: repoRoot
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      import: importPlugin
    },
    settings: {
      react: {
        version: 'detect'
      },
      'import/resolver': {
        typescript: {
          project: [
            'tsconfig.json',
            'apps/*/tsconfig.json',
            'apps/*/tsconfig.eslint.json',
            'packages/*/tsconfig.json',
            'packages/*/tsconfig.eslint.json'
          ]
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
          moduleDirectory: ['node_modules', workspaceNodeModules]
        }
      }
    },
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off'
    }
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  }
];
