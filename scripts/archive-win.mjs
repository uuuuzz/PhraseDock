import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('请在 Windows 上归档 Windows 应用。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verify = spawnSync(process.execPath, [path.join(root, 'scripts/verify-package-win.mjs')], { stdio: 'inherit', windowsHide: true });
if (verify.status !== 0) process.exit(verify.status ?? 1);
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-File', path.join(root, 'scripts/archive-win.ps1'),
  '-Version', version, '-Architecture', process.arch], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
