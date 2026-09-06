import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('dotnet', ['run', '--project', path.join(root, 'test/windows-clipboard/PhraseDock.ClipboardTests.csproj'),
  '--configuration', 'Release', '--no-launch-profile'], { stdio: 'inherit', windowsHide: true });
if (result.error) throw new Error('请安装 .NET 10 SDK 后运行剪贴板回归测试。');
if (result.status !== 0) process.exit(result.status ?? 1);
