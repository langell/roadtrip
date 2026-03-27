import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'dist/index.js');

const source = await readFile(filePath, 'utf8');
const next = source.replace("from './schemas/trip';", "from './schemas/trip.js';");

if (next !== source) {
  await writeFile(filePath, next, 'utf8');
}
