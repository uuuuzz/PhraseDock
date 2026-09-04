'use strict';

const { spawn } = require('node:child_process');

function createMacPlatform(helperPath, initialTarget) {
  let target = initialTarget;
  let inserting = false;
  let cachedStatus = null;
  let statusRequest = null;
  const children = new Set();

  function call(action, extra = {}) {
    return new Promise(resolve => {
      const child = spawn(helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      children.add(child);
      let output = '';
      let settled = false;
      const done = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        children.delete(child);
        resolve(value);
      };
      const timer = setTimeout(() => {
        child.kill();
        done({ ok: false, code: 'timeout', message: '输入检查超时，请重新点击输入框后再试。' });
      }, 5000);
      child.stdout.on('data', data => { output += data.toString('utf8'); });
      // Do not log text, clipboard contents, or AX values.
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => done({ ok: false, code: 'helper-missing', message: '系统组件不可用，请重新构建应用。' }));
      child.on('close', () => {
        try { done(JSON.parse(output)); }
        catch { done({ ok: false, code: 'helper-failed', message: '系统组件没有返回有效结果。' }); }
      });
      child.stdin.end(JSON.stringify({ action, bundleIds: target.macBundleIds, ...extra }));
    });
  }

  return {
    configure(value) { target = value; cachedStatus = null; },
    async status() {
      if (inserting && cachedStatus) return cachedStatus;
      if (!statusRequest) {
        statusRequest = call('status').then(value => {
          cachedStatus = value;
          return value;
        }).finally(() => { statusRequest = null; });
      }
      return statusRequest;
    },
    async insert(text, expectedPid) {
      if (inserting) return { ok: false, code: 'busy', message: '上一段正在插入，请稍候。' };
      inserting = true;
      try { return await call('insert', { text, expectedPid }); }
      finally { inserting = false; }
    },
    close() { for (const child of children) child.kill(); children.clear(); }
  };
}

module.exports = { createMacPlatform };
