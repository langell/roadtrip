import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'dist/index.js');

const source = await readFile(filePath, 'utf8');
// Add .js extension to all relative bare imports (no extension yet)
const next = source.replace(/from '(\.[^']+)(?<!\.js)'/g, "from '$1.js'");

if (next !== source) {
  await writeFile(filePath, next, 'utf8');
}
