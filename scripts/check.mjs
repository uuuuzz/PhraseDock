import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

for (const folder of ['src', 'scripts', 'test']) {
  for (const file of readdirSync(folder, { recursive: true })) {
    if (!/\.(cjs|mjs|js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(folder, file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
console.log('JavaScript syntax checks passed.');
