import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const filteredArgs = rawArgs.filter((arg) => arg !== '--coverage');
const env = {
  ...process.env,
  CI: process.env.CI ?? '1',
  AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'roadtrip-test-auth-secret-change-me',
};

const child = spawn('pnpm', ['exec', 'playwright', 'test', ...filteredArgs], {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
