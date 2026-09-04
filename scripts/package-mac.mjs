import { packager } from '@electron/packager';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_IDENTIFIER, signApplication } from './signing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') throw new Error('请在 macOS 上打包 Mac 应用。');
const build = spawnSync(process.execPath, [path.join(root, 'scripts/build-native.mjs')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const packaged = await packager({
  dir: root, name: 'PhraseDock', platform: 'darwin', arch: process.arch,
  out: path.join(root, 'dist'), overwrite: true, asar: true,
  appBundleId: APP_IDENTIFIER, appVersion: '0.1.0',
  executableName: 'PhraseDock',
  extendInfo: { LSUIElement: true, NSAccessibilityUsageDescription: '把你点击的短语插入当前输入框。' },
  extraResource: [path.join(root, 'build/PhraseBridge')],
  ignore: [/^\/build(?:\/|$)/, /^\/dist(?:\/|$)/, /^\/native(?:\/|$)/,
    /^\/scripts(?:\/|$)/, /^\/test(?:\/|$)/, /^\/docs(?:\/|$)/, /^\/\.git(?:\/|$)/]
});
for (const directory of packaged) {
  const appPath = path.join(directory, 'PhraseDock.app');
  const identity = signApplication(appPath);
  console.log(`${appPath}\nSigned by: ${identity.name} (${identity.sha1})`);
}
