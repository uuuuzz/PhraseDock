import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  throw new Error('Icon generation currently requires macOS sips, iconutil, and Swift. Commit the generated .icns/.ico files for builds on other systems.');
}
const sourceDir = path.join(root, 'resources/icons/source');
const outputDir = path.join(root, 'resources/icons');
const workDir = path.join(root, 'build/icons');
const iconset = path.join(workDir, 'PhraseDock.iconset');
const macSource = path.join(sourceDir, 'PhraseDock-macos.png');
const windowsSource = path.join(sourceDir, 'PhraseDock-windows.png');
mkdirSync(iconset, { recursive: true });

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.trim() || result.stdout?.trim() || `${command} failed`);
  }
}

function resize(input, size, output) {
  run('sips', ['--resampleHeightWidth', String(size), String(size), '--setProperty', 'format', 'png', input, '--out', output]);
}

rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });
const macFiles = [
  ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024]
];
for (const [name, size] of macFiles) resize(macSource, size, path.join(iconset, name));
run('iconutil', ['--convert', 'icns', iconset, '--output', path.join(outputDir, 'PhraseDock.icns')]);

const windowsSizes = [16, 24, 32, 48, 64, 128, 256];
const windowsPngs = windowsSizes.map(size => {
  const output = path.join(workDir, `windows-${size}.png`);
  // Keep roughly 5% transparent padding on each side.
  const artworkSize = Math.max(1, Math.round(size * 0.9));
  run('swift', [path.join(root, 'scripts/pad-icon.swift'), windowsSource, output, String(size), String(artworkSize)]);
  return readFileSync(output);
});
const header = Buffer.alloc(6 + windowsPngs.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(windowsPngs.length, 4);
let offset = header.length;
for (let index = 0; index < windowsPngs.length; index++) {
  const size = windowsSizes[index];
  const entry = 6 + index * 16;
  header.writeUInt8(size === 256 ? 0 : size, entry);
  header.writeUInt8(size === 256 ? 0 : size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(windowsPngs[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += windowsPngs[index].length;
}
writeFileSync(path.join(outputDir, 'PhraseDock.ico'), Buffer.concat([header, ...windowsPngs]));
console.log('Generated resources/icons/PhraseDock.icns and resources/icons/PhraseDock.ico');
