import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareElectronWindows } from './prepare-electron-win.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = spawnSync(process.execPath, [path.join(root, 'scripts/build-native.mjs')], { stdio: 'inherit', windowsHide: true });
if (build.status !== 0) process.exit(build.status ?? 1);
if (process.platform === 'win32') {
  const runtime = prepareElectronWindows();
  const dist = path.join(runtime.electronRoot, 'dist');
  const versionFile = path.join(dist, 'version');
  const expected = JSON.parse(readFileSync(path.join(runtime.electronRoot, 'package.json'), 'utf8')).version;
  if (!existsSync(path.join(dist, 'electron.exe')) || !existsSync(versionFile) || readFileSync(versionFile, 'utf8').trim().replace(/^v/, '') !== expected) {
    const { default: extractZip } = await import('@electron-internal/extract-zip');
    await extractZip(runtime.archive, { dir: dist });
  }
  writeFileSync(path.join(runtime.electronRoot, 'path.txt'), 'electron.exe');
}
const require = createRequire(import.meta.url);
const result = spawnSync(require('electron'), [root], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
