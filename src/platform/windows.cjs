'use strict';

// Explicit extension point. No untested Windows input implementation is shipped.
// Implement foreground HWND + focused UIA editable element + SendInput/paste here.
function createWindowsPlatform() {
  const unavailable = async () => ({
    ok: false, ready: false, trusted: false, code: 'unsupported',
    message: '当前版本支持 macOS，Windows 输入适配待实现。'
  });
  return { status: unavailable, insert: unavailable, configure() {}, close() {} };
}

module.exports = { createWindowsPlatform };
