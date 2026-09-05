import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function prepareElectronWindows() {
  if (process.platform !== 'win32') throw new Error('Windows runtime preparation requires Windows.');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const electronRoot = path.join(root, 'node_modules/electron');
  const { version } = JSON.parse(readFileSync(path.join(electronRoot, 'package.json'), 'utf8'));
  const filename = `electron-v${version}-win32-${process.arch}.zip`;
  const checksums = JSON.parse(readFileSync(path.join(electronRoot, 'checksums.json'), 'utf8'));
  const expected = checksums[filename];
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) throw new Error('Pinned Electron checksum is missing.');
  const directory = path.join(root, 'build/electron');
  const archive = path.join(directory, filename);
  const valid = () => existsSync(archive) && createHash('sha256').update(readFileSync(archive)).digest('hex') === expected;
  if (!valid()) {
    console.log(`Downloading official Electron ${version} for Windows ${process.arch}…`);
    const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-File', path.join(root, 'scripts/download-electron-win.ps1'),
      '-Version', version, '-Architecture', process.arch, '-Destination', archive], { stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw new Error('Electron download failed. PowerShell 7 and access to GitHub releases are required.');
  }
  if (!valid()) throw new Error('Electron archive SHA-256 does not match the pinned npm package.');
  console.log(`Electron archive SHA-256 verified (${version}, ${process.arch}).`);
  return { directory, archive, electronRoot };
}
