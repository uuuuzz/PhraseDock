'use strict';
const { spawn } = require('node:child_process');

// Never terminate a timed-out paste: it may still be restoring the clipboard.
function createBridgeClient(helperPath, requestFor, options = {}) {
  const launch = options.spawn || spawn;
  const timeoutMs = options.timeoutMs || 12000;
  const children = new Map();
  let activeInsert = null, statusRequest = null, closing = false;
  const pending = () => ({ ok: false, ready: false, code: 'pending',
    message: '上一段仍在收尾，请先检查输入结果，暂不重复点击。' });
  function call(action, extra = {}) {
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    return new Promise(resolve => {
      let child;
      try { child = launch(helperPath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
      catch { finish(); resolve({ ok: false, ready: false, code: 'helper-missing', message: '系统组件不可用，请重新构建应用。' }); return; }
      children.set(child, { action, finished });
      if (action === 'insert') activeInsert = child;
      let output = '', settled = false, invalidOutput = false;
      const settle = value => { if (!settled) { settled = true; resolve(value); } };
      const timer = setTimeout(() => {
        if (action !== 'insert') child.kill();
        settle(action === 'insert' ? pending() : { ok: false, ready: false, code: 'timeout', message: '输入检查超时，请稍候。' });
      }, action === 'insert' ? timeoutMs : Math.min(timeoutMs, 5000));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', data => {
        if (output.length + data.length > 32768) invalidOutput = true;
        else if (!invalidOutput) output += data;
      });
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => settle({ ok: false, ready: false, code: 'helper-missing', message: '系统组件不可用，请重新构建应用。' }));
      child.on('close', code => {
        clearTimeout(timer);
        children.delete(child);
        if (activeInsert === child) activeInsert = null;
        try {
          const value = JSON.parse(output);
          if (code !== 0 || invalidOutput || typeof value.ok !== 'boolean' || typeof value.code !== 'string' || typeof value.message !== 'string') throw new Error();
          settle(value);
        } catch {
          settle({ ok: false, ready: false, code: 'helper-failed', message: action === 'insert'
            ? '输入组件异常结束，请检查文字和剪贴板，不要直接重复点击。' : '系统组件没有返回有效结果。' });
        }
        finish();
      });
      child.stdin.end(JSON.stringify(requestFor(action, extra)));
    });
  }
  return {
    status() {
      if (closing || activeInsert) return Promise.resolve(pending());
      if (!statusRequest) statusRequest = call('status').finally(() => { statusRequest = null; });
      return statusRequest;
    },
    insert(text, expectedPid, expectedTarget) {
      if (closing || activeInsert) return Promise.resolve(pending());
      return call('insert', { text, expectedPid, ...(expectedTarget ? { expectedTarget } : {}) });
    },
    async close() {
      closing = true;
      const waits = [];
      for (const [child, request] of children) {
        if (request.action !== 'insert') child.kill();
        waits.push(request.finished);
      }
      await Promise.all(waits);
    }
  };
}
module.exports = { createBridgeClient };
