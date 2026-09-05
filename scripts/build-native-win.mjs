import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('请在 Windows 上构建 Windows 输入组件。');
if (!['x64', 'arm64'].includes(process.arch)) throw new Error('仅提供 x64 / arm64 构建入口。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('dotnet', ['publish', path.join(root, 'native/windows/PhraseBridge.csproj'),
  '--configuration', 'Release', '--runtime', `win-${process.arch}`, '--self-contained', 'true',
  '--output', path.join(root, 'build/windows'), '--nologo', '-p:DebugSymbols=false'],
  { stdio: 'inherit', windowsHide: true });
if (result.error) throw new Error('请安装 .NET 10 SDK 后重新构建。');
if (result.status !== 0) process.exit(result.status ?? 1);
