import { execSync } from 'node:child_process';

const [portArg] = process.argv.slice(2);
const port = Number(portArg);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('Usage: node scripts/kill-port.mjs <port>');
  process.exit(1);
}

const findListeningPids = () => {
  try {
    const output = execSync(`lsof -n -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!output) {
      return [];
    }

    return [...new Set(output.split('\n').map((value) => value.trim()).filter(Boolean))]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
};

const pids = findListeningPids();

if (!pids.length) {
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore - process may already be gone or not owned by current user
  }
}
