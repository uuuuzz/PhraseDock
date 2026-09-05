'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig } = require('../src/core/config.cjs');
const defaults = require('../config/phrases.json');

test('old macOS configurations gain Windows defaults without modifying user data', () => {
  const old = structuredClone(defaults);
  delete old.target.windowsExecutables;
  delete old.target.windowsPackageFamilyNames;
  old.phrases[0].text = '个人短语\n 😀 ';
  const before = JSON.stringify(old);
  const result = validateConfig(old);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(result.target.windowsExecutables, ['codex.exe']);
  assert.deepEqual(result.target.windowsPackageFamilyNames, ['openai.codex_2p2nqsd0c76g0']);
  assert.equal(result.phrases[0].text, old.phrases[0].text);
});

test('existing Windows 0.1.0 user configurations gain Store identity without rewrite', () => {
  const old = structuredClone(defaults);
  delete old.target.windowsPackageFamilyNames;
  const original = JSON.stringify(old);
  const result = validateConfig(old);
  assert.deepEqual(result.target.windowsPackageFamilyNames, ['openai.codex_2p2nqsd0c76g0']);
  assert.equal(JSON.stringify(old), original);
});
test('package family configuration rejects broad or malformed identities and allows explicit opt-out', () => {
  for (const name of ['OpenAI.Codex_*', 'ChatGPT.exe', 'OpenAI.Codex_2p2nqsd0c76g0\n', 'C:\\OpenAI.Codex_2p2nqsd0c76g0']) {
    assert.throws(() => validateConfig({ ...defaults, target: { ...defaults.target, windowsPackageFamilyNames: [name] } }));
  }
  assert.deepEqual(validateConfig({ ...defaults, target: { ...defaults.target, windowsPackageFamilyNames: [] } }).target.windowsPackageFamilyNames, []);
});
test('Windows allowlist rejects paths, wildcards and malformed names', () => {
  for (const name of ['../Codex.exe', 'C:\\Codex.exe', '*.exe', 'Codex', '', 'x.exe\n']) {
    assert.throws(() => validateConfig({ ...defaults, target: { ...defaults.target, windowsExecutables: [name] } }));
  }
  assert.throws(() => validateConfig({ ...defaults, target: { ...defaults.target, windowsExecutables: [] } }));
  assert.deepEqual(validateConfig({ ...defaults, target: { ...defaults.target, windowsExecutables: ['Codex.exe', 'codex.exe'] } }).target.windowsExecutables, ['codex.exe']);
});
