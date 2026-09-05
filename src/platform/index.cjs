'use strict';

// Platform contract: status(), insert(text, expectedPid), configure(target), close().
// UI and phrase management must never call OS APIs directly.
function createPlatform({ platform, helperPath, target }) {
  if (platform === 'darwin') return require('./macos.cjs').createMacPlatform(helperPath, target);
  if (platform === 'win32') return require('./windows.cjs').createWindowsPlatform(helperPath, target);
  const unavailable = async () => ({ ok: false, ready: false, code: 'unsupported', message: '当前系统尚未提供输入适配。' });
  return { status: unavailable, insert: unavailable, configure() {}, async close() {} };
}

module.exports = { createPlatform };
