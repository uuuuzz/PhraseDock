'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const success = { ok: true, ready: true, verified: true, code: 'inserted', message: 'verified', targetKey: '42:window:element' };

function element() {
  const classes = new Set();
  return { classList: { add: x => classes.add(x), remove: x => classes.delete(x),
    toggle(x, flag) { if (flag) classes.add(x); else classes.delete(x); }, contains: x => classes.has(x) },
    setAttribute(){}, addEventListener(){}, replaceChildren(){}, style: {setProperty(){}}, append(){} };
}
async function fixture() {
  const nodes = Object.fromEntries(['phrases', 'hub', 'toast'].map(id => [id, element()]));
  const hooks = {}, calls = [];
  let finishFirst;
  const first = new Promise(resolve => { finishFirst = resolve; });
  const api = {
    insert(id, expectedTarget) { calls.push({ id, expectedTarget }); return calls.length === 1 ? first : Promise.resolve(success); },
    pointerPassthrough(){}, onStatus(fn){ hooks.status = fn; }, onResult(fn){ hooks.result = fn; },
    onConfig(fn){ hooks.config = fn; }, onExpanded(fn){ hooks.expanded = fn; },
    initial: async () => ({ phrases: [], layout: {}, expanded: false })
  };
  const context = vm.createContext({ window: {phraseDock: api}, document: {getElementById: id => nodes[id],
    addEventListener(){}, body: element(), createElement: element},
    setTimeout(){return 1;}, clearTimeout(){}, performance: {now: () => 0}, requestAnimationFrame: fn => fn() });
  vm.runInContext(source, context);
  await tick();
  return { context, nodes, hooks, calls, finishFirst };
}
test('unverified first paste remains visible and cancels queued phrases', async () => {
  const f = await fixture();
  const secondButton = element();
  f.context.enqueueInsertion('first', element());
  f.context.enqueueInsertion('second', secondButton);
  f.finishFirst({ ok: true, ready: true, verified: false, code: 'sent-unverified', message: 'must confirm' });
  await tick();
  assert.deepEqual(f.calls.map(x => x.id), ['first']);
  assert.equal(f.nodes.toast.textContent, 'must confirm');
  assert.equal(secondButton.classList.contains('pending'), false);
});
test('verified queue preserves order and binds subsequent calls to the first target', async () => {
  const f = await fixture();
  f.context.enqueueInsertion('first', element()); f.context.enqueueInsertion('second', element());
  f.finishFirst(success); await tick();
  assert.deepEqual(f.calls.map(x => x.id), ['first', 'second']);
  assert.equal(f.calls[1].expectedTarget, success.targetKey);
});
test('queue limits total pending work to eight entries', async () => {
  const f = await fixture();
  for (let i = 0; i < 12; i++) f.context.enqueueInsertion(String(i), element());
  f.finishFirst(success); await tick();
  assert.equal(f.calls.length, 8);
});
test('configuration reload drops queued IDs that may now mean different phrases', async () => {
  const f = await fixture();
  f.context.enqueueInsertion('first', element()); f.context.enqueueInsertion('second', element());
  f.hooks.config({ phrases: [], layout: {} });
  f.finishFirst(success); await tick();
  assert.equal(f.calls.length, 1);
});
test('collapsed buttons are inert and become available only on expansion', async () => {
  const f = await fixture();
  assert.equal(f.nodes.phrases.inert, true);
  f.hooks.expanded(true); assert.equal(f.nodes.phrases.inert, false);
});
