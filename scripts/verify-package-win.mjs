import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractFile, listPackage } from '@electron/asar';
import * as PE from 'pe-library';
import { Resource } from 'resedit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version: packageVersion, productName, productNameZh } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const directory = process.argv[2] || path.join(root, 'dist', packageVersion, `PhraseDock-win32-${process.arch}`);
const archive = path.join(directory, 'resources/app.asar');
for (const file of ['src/main.cjs', 'src/preload.cjs', 'src/platform/bridge-client.cjs', 'src/platform/windows.cjs',
  'src/platform/macos.cjs', 'src/platform/index.cjs', 'src/core/config.cjs', 'src/core/radial-layout.cjs',
  'src/renderer/index.html', 'src/renderer/style.css', 'src/renderer/renderer.js', 'config/phrases.json',
  'resources/icons/PhraseDock.ico', 'resources/icons/PhraseDock.icns']) {
  assert.deepEqual(extractFile(archive, path.normalize(file)), readFileSync(path.join(root, file)), `Packaged source differs: ${file}`);
}
assert.equal(listPackage(archive).some(name => /^[/\\](native|build|dist|test|scripts|\.git)([/\\]|$)/.test(name)), false);
const helper = path.join(directory, 'resources/windows/PhraseBridge.exe');
for (const name of ['PhraseBridge.exe', 'PhraseBridge.dll', 'coreclr.dll', 'UIAutomationClient.dll']) {
  assert.ok(existsSync(path.join(directory, 'resources/windows', name)), `Native runtime missing: ${name}`);
}
const resources = PE.NtExecutableResource.from(PE.NtExecutable.from(readFileSync(path.join(directory, 'PhraseDock.exe'))));
const ico = readFileSync(path.join(root, 'resources/icons/PhraseDock.ico'));
const count = ico.readUInt16LE(4);
const expectedImages = Array.from({length: count}, (_, i) => {
  const offset = ico.readUInt32LE(6 + i * 16 + 12), size = ico.readUInt32LE(6 + i * 16 + 8);
  return ico.subarray(offset, offset + size);
});
const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
assert.ok(groups.some(group => group.icons.length === count && group.icons.every((icon, index) => {
  const entry = resources.entries.find(item => item.type === 3 && item.id === icon.iconID && item.lang === group.lang);
  return entry && Buffer.from(entry.bin).equals(expectedImages[index]);
})), 'Executable icon group must exactly match the seven source ICO images.');
const version = Resource.VersionInfo.fromEntries(resources.entries)[0];
assert.ok(version.getAvailableLanguages().some(language => {
  const values = version.getStringValues(language);
  return values.ProductName === productName && values.FileDescription === `${productNameZh} · ${productName}`;
}));
if (process.platform === 'win32') {
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/test-native-win.mjs'), helper], { stdio: 'inherit', windowsHide: true });
  assert.equal(check.status, 0);
}
console.log('Package verified: source parity, runtime files, executable branding, seven exact ICO images, packaged native self-tests. GUI not launched.');
