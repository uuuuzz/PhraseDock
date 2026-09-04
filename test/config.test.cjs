'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, visibleBounds } = require('../src/core/config.cjs');
const { COLLAPSED_SIZE, radialLayout, boundsAroundAnchor, restoreAnchor } = require('../src/core/radial-layout.cjs');
const defaults = require('../config/phrases.json');

test('preserves literal Unicode, whitespace and shell-like text without evaluation', () => {
  const text = '  中文 😀\n$(touch nope) `echo nope`\\path\n';
  const value = structuredClone(defaults);
  value.phrases = [{ id: 'literal', label: '  多行  ', text }];
  const result = validateConfig(value);
  assert.equal(result.phrases[0].text, text);
  assert.equal(result.phrases[0].label, '多行');
});
test('rejects ambiguous IDs and invalid target configuration', () => {
  const value = structuredClone(defaults);
  value.phrases[1].id = value.phrases[0].id;
  assert.throws(() => validateConfig(value), /不能重复/);
  assert.throws(() => validateConfig({ ...defaults, target: { macBundleIds: [] } }), /应用标识/);
});
test('recovers a palette after an external display is disconnected', () => {
  const result = visibleBounds({ x: 2900, y: 100 }, [{ x: 0, y: 25, width: 1440, height: 875 }], 292, 312);
  assert.ok(result.x >= 0 && result.x + result.width <= 1440);
  assert.ok(result.y >= 25 && result.y + result.height <= 900);
});
test('clamps expanded palette to the visible area on a negative-coordinate display', () => {
  const result = visibleBounds({ x: -1500, y: 650 }, [{ x: -1920, y: 0, width: 1920, height: 900 }], 292, 456);
  assert.equal(result.x, -1500);
  assert.equal(result.y, 444);
});
test('places six phrases around the hub without overlapping', () => {
  const layout = radialLayout(6);
  assert.deepEqual({ width: layout.width, height: layout.height }, { width: 344, height: 284 });
  for (let a = 0; a < layout.positions.length; a++) for (let b = a + 1; b < layout.positions.length; b++) {
    const first = layout.positions[a], second = layout.positions[b];
    const overlapX = Math.abs(first.x - second.x) < layout.buttonWidth;
    const overlapY = Math.abs(first.y - second.y) < layout.buttonHeight;
    assert.equal(overlapX && overlapY, false, `buttons ${a} and ${b} overlap`);
  }
});
test('supports every allowed phrase count without clipping or overlapping buttons', () => {
  for (let count = 1; count <= 12; count++) {
    const layout = radialLayout(count);
    for (const position of layout.positions) {
      assert.ok(Math.abs(position.x) + layout.buttonWidth / 2 <= layout.width / 2);
      assert.ok(Math.abs(position.y) + layout.buttonHeight / 2 <= layout.height / 2);
    }
    for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
      const first = layout.positions[a], second = layout.positions[b];
      assert.equal(Math.abs(first.x - second.x) < layout.buttonWidth &&
        Math.abs(first.y - second.y) < layout.buttonHeight, false, `${count} buttons: ${a} and ${b} overlap`);
    }
  }
});
test('expansion shifts an edge anchor just enough to remain visible', () => {
  const area = { x: 0, y: 25, width: 1440, height: 875 };
  const result = boundsAroundAnchor({ x: 1420, y: 450 }, radialLayout(6), [area]);
  assert.deepEqual(result.anchor, { x: 1268, y: 450 });
  assert.deepEqual(result.bounds, { x: 1096, y: 308, width: 344, height: 284 });
});
test('migrates the old top-left position to a collapsed hub center', () => {
  const result = restoreAnchor({ x: 100, y: 200 }, [{ x: 0, y: 25, width: 1440, height: 875 }]);
  assert.deepEqual(result, { x: 246, y: 362 });
  assert.deepEqual(COLLAPSED_SIZE, { width: 72, height: 72 });
});
