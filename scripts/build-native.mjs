import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signNativeFile } from './signing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  console.log('当前平台没有原生输入组件；Windows 接口已预留。');
  process.exit(0);
}
const source = path.join(root, 'native/macos/PhraseBridge.swift');
const output = path.join(root, 'build/PhraseBridge');
mkdirSync(path.dirname(output), { recursive: true });
let current = false;
try { current = statSync(output).mtimeMs >= statSync(source).mtimeMs; } catch {}
if (!current) {
  const result = spawnSync('swiftc', ['-O', '-framework', 'AppKit', '-framework', 'ApplicationServices',
    '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos13.0`, source, '-o', output],
    { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
signNativeFile(output);
console.log(`Native bridge: ${output}`);
