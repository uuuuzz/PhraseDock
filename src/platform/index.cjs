'use strict';

// Platform contract: status(), insert(text, expectedPid), configure(target), close().
// UI and phrase management must never call OS APIs directly.
function createPlatform({ platform, helperPath, target }) {
  if (platform === 'darwin') return require('./macos.cjs').createMacPlatform(helperPath, target);
  return require('./windows.cjs').createWindowsPlatform();
}

module.exports = { createPlatform };
