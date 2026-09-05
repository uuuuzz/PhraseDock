import { packager } from '@electron/packager';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_IDENTIFIER, signApplication } from './signing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version, productName } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
if (process.platform !== 'darwin') throw new Error('请在 macOS 上打包 Mac 应用。');
const icons = spawnSync(process.execPath, [path.join(root, 'scripts/build-icons.mjs')], { stdio: 'inherit' });
if (icons.status !== 0) process.exit(icons.status ?? 1);
const build = spawnSync(process.execPath, [path.join(root, 'scripts/build-native.mjs')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const packaged = await packager({
  dir: root, name: 'PhraseDock', platform: 'darwin', arch: process.arch,
  out: path.join(root, 'dist'), overwrite: true, asar: true,
  appBundleId: APP_IDENTIFIER, appVersion: version,
  icon: path.join(root, 'resources/icons/PhraseDock.icns'),
  executableName: 'PhraseDock',
  extendInfo: { LSUIElement: true, CFBundleDisplayName: productName, CFBundleName: productName,
    NSAccessibilityUsageDescription: '把你点击的常用 AI 提示词追加到当前输入框光标处。' },
  extraResource: [path.join(root, 'build/PhraseBridge')],
  ignore: [/^\/build(?:\/|$)/, /^\/dist(?:\/|$)/, /^\/native(?:\/|$)/,
    /^\/scripts(?:\/|$)/, /^\/test(?:\/|$)/, /^\/docs(?:\/|$)/, /^\/\.git(?:\/|$)/]
});
for (const directory of packaged) {
  const appPath = path.join(directory, 'PhraseDock.app');
  const identity = signApplication(appPath);
  console.log(`${appPath}\nSigned by: ${identity.name} (${identity.sha1})`);
}
