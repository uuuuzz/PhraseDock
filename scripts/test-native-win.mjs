import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('请在 Windows 上运行输入组件的纯逻辑自测。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = process.argv[2] || path.join(root, 'build/windows/PhraseBridge.exe');
function run(request) {
  const processResult = spawnSync(helper, [], { input: JSON.stringify(request), encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(processResult.status, 0, 'Native helper should exit cleanly.');
  return JSON.parse(processResult.stdout);
}
const capabilities = run({ action: 'capabilities' });
assert.equal(capabilities.platform, 'win32');
const result = run({ action: 'self-test' });
assert.equal(result.ok, true);
assert.ok(result.passed >= 19);
assert.equal(run({ action: 'unknown' }).code, 'invalid');
assert.equal(run({ action: 'insert', executables: ['Codex.exe'], text: '\0', expectedPid: 42 }).code, 'invalid');
console.log(`Windows native self-tests: ${result.passed} passed; protocol rejection checks passed. No desktop or clipboard operations.`);
