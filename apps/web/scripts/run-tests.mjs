import { spawn } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const filteredArgs = rawArgs.filter((arg) => arg !== '--coverage');

const child = spawn('pnpm', ['exec', 'playwright', 'test', ...filteredArgs], {
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
