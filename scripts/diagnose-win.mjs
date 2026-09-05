import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
if (process.platform !== 'win32') throw new Error('此诊断只适用于 Windows。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { validateConfig } = require('../src/core/config.cjs');
const userFile = process.env.APPDATA && path.join(process.env.APPDATA, 'PhraseDock', 'phrases.json');
const file = userFile && existsSync(userFile) ? userFile : path.join(root, 'config/phrases.json');
let target;
try { target = validateConfig(JSON.parse(readFileSync(file, 'utf8'))).target; }
catch { throw new Error('短语配置无效，请先检查配置文件。'); }
const helper = process.argv[2] || path.join(root, 'build/windows/PhraseBridge.exe');
const result = spawnSync(helper, [], { input: JSON.stringify({ action: 'diagnose', executables: target.windowsExecutables,
  packageFamilyNames: target.windowsPackageFamilyNames }), encoding: 'utf8', windowsHide: true, timeout: 7000 });
if (result.error || result.status !== 0) throw new Error('诊断组件未能正常结束，请先运行 build:native。');
console.log(JSON.stringify(JSON.parse(result.stdout), null, 2));
