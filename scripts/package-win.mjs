import { packager } from '@electron/packager';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareElectronWindows } from './prepare-electron-win.mjs';

if (process.platform !== 'win32') throw new Error('请在 Windows 上打包 Windows 应用。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version, productName, productNameZh } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['test-clipboard-win.mjs', 'build-native-win.mjs', 'test-native-win.mjs']) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const electron = prepareElectronWindows();
const packaged = await packager({
  dir: root, name: 'PhraseDock', platform: 'win32', arch: process.arch,
  out: path.join(root, 'dist', version), overwrite: true, asar: true,
  electronZipDir: electron.directory,
  appVersion: version, buildVersion: version, executableName: 'PhraseDock',
  icon: path.join(root, 'resources/icons/PhraseDock.ico'),
  win32metadata: { CompanyName: 'PhraseDock', FileDescription: `${productNameZh} · ${productName}`, ProductName: productName,
    InternalName: 'PhraseDock', OriginalFilename: 'PhraseDock.exe' },
  extraResource: [path.join(root, 'build/windows')],
  ignore: [/^[/\\]build(?:[/\\]|$)/, /^[/\\]dist(?:[/\\]|$)/, /^[/\\]native(?:[/\\]|$)/,
    /^[/\\]scripts(?:[/\\]|$)/, /^[/\\]test(?:[/\\]|$)/, /^[/\\]docs(?:[/\\]|$)/, /^[/\\]\.git(?:[/\\]|$)/]
});
for (const directory of packaged) {
  writeFileSync(path.join(directory, '使用说明.txt'),
    `${productNameZh}\r\n${productName}\r\n\r\n双击 PhraseDock.exe。请保留整个目录，不要只复制 exe。\r\n` +
    '先点击 Codex 输入框，再展开 + 并点击提示词。只插入，不自动发送。\r\n' +
    '右键中央按钮或系统托盘图标可编辑、刷新、测试、隐藏和退出。\r\n' +
    '个人配置保存在 %APPDATA%\\PhraseDock，更新程序不会覆盖。\r\n' +
    '首次使用请先打开输入测试，检查光标、选区、连续点击和剪贴板。\r\n' +
    '已完成编译与纯逻辑测试；真实桌面输入与视觉效果待手动验收。\r\n', 'utf8');
  console.log(path.join(directory, 'PhraseDock.exe'));
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/verify-package-win.mjs'), directory], { stdio: 'inherit', windowsHide: true });
  if (check.status !== 0) process.exit(check.status ?? 1);
}
