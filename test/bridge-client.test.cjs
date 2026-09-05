'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createBridgeClient } = require('../src/platform/bridge-client.cjs');
const { createPlatform } = require('../src/platform/index.cjs');

function fixture(timeoutMs = 1000) {
  const calls = [];
  const client = createBridgeClient('helper.exe', (action, extra) => ({ action, ...extra }), {
    timeoutMs, spawn(file, args, options) {
      const child = new EventEmitter();
      Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kills: 0, input: '' });
      child.stdin.on('data', data => { child.input += data; });
      child.kill = () => { child.kills++; setImmediate(() => child.emit('close', null)); };
      child.complete = result => { child.stdout.end(JSON.stringify(result)); child.emit('close', 0); };
      calls.push({ file, args, options, child });
      return child;
    }
  });
  return { client, calls };
}
const success = { ok: true, ready: true, code: 'inserted', message: 'done', verified: true };

test('literal text crosses stdin JSON only; native process is hidden', async () => {
  const { client, calls } = fixture();
  const text = ' 中文 😀\n$(unused) `literal` " \\ ';
  const response = client.insert(text, 4, 'target');
  assert.deepEqual(calls[0].args, []);
  assert.equal(calls[0].options.windowsHide, true);
  assert.equal(JSON.parse(calls[0].child.input).text, text);
  calls[0].child.complete(success);
  assert.equal((await response).verified, true);
  await client.close();
});
test('insert timeout keeps helper alive, blocks another paste and drains on close', async () => {
  const { client, calls } = fixture(20);
  assert.equal((await client.insert('one', 4)).code, 'pending');
  assert.equal(calls[0].child.kills, 0);
  assert.equal((await client.insert('two', 4)).code, 'pending');
  assert.equal((await client.status()).code, 'pending');
  assert.equal(calls.length, 1);
  let closed = false;
  const closing = client.close().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  calls[0].child.complete(success);
  await closing;
  assert.equal(calls[0].child.kills, 0);
});
test('read-only timeouts may stop status helper, without starting any insert', async () => {
  const { client, calls } = fixture(20);
  assert.equal((await client.status()).code, 'timeout');
  assert.equal(calls[0].child.kills, 1);
  await client.close();
});
test('malformed or failed output stays uncertain and does not trigger retry', async () => {
  const { client, calls } = fixture();
  const response = client.insert('one', 4);
  calls[0].child.stdout.end('invalid'); calls[0].child.emit('close', 1);
  assert.equal((await response).code, 'helper-failed');
  assert.equal(calls.length, 1);
  await client.close();
});
test('UTF-8 output split inside a multibyte character remains intact', async () => {
  const { client, calls } = fixture();
  const response = client.status();
  const bytes = Buffer.from(JSON.stringify({ ...success, message: '中文😀' }));
  for (const byte of bytes) calls[0].child.stdout.write(Buffer.from([byte]));
  calls[0].child.emit('close', 0);
  assert.equal((await response).message, '中文😀');
  await client.close();
});
test('unsupported platforms never silently route to Windows input', async () => {
  assert.equal((await createPlatform({ platform: 'linux' }).status()).code, 'unsupported');
});
