'use strict';

function validateConfig(value) {
  if (!value || value.schemaVersion !== 1) throw new Error('schemaVersion 必须为 1。');
  const bundleIds = value.target?.macBundleIds;
  if (!Array.isArray(bundleIds) || bundleIds.length < 1 || bundleIds.length > 16 ||
      bundleIds.some(id => typeof id !== 'string' || !/^[\w.-]{3,160}$/.test(id))) {
    throw new Error('target.macBundleIds 必须是有效的应用标识列表。');
  }
  if (!Array.isArray(value.phrases) || value.phrases.length < 1 || value.phrases.length > 12) {
    throw new Error('请配置 1～12 个短语。');
  }
  const ids = new Set();
  const phrases = value.phrases.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id) || ids.has(item.id)) {
      throw new Error('短语 id 只能包含英文、数字、横线、下划线，且不能重复。');
    }
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 16) {
      throw new Error('按钮名称不能为空，且不能超过 16 个字符。');
    }
    if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 8000 || item.text.includes('\0')) {
      throw new Error('短语内容不能为空，不能包含空字符，最多 8000 个字符。');
    }
    ids.add(item.id);
    return { id: item.id, label: item.label.trim(), text: item.text };
  });
  return { schemaVersion: 1, target: { macBundleIds: [...new Set(bundleIds)] }, phrases };
}

function visibleBounds(saved, areas, width, height) {
  const match = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) &&
    areas.find(area => saved.x < area.x + area.width && saved.x + width > area.x &&
      saved.y < area.y + area.height && saved.y + height > area.y);
  const area = match || areas[0];
  const x = match ? saved.x : area.x + area.width - width - 24;
  const y = match ? saved.y : area.y + Math.max(24, (area.height - height) / 2);
  return {
    x: Math.round(Math.max(area.x, Math.min(x, area.x + Math.max(0, area.width - width)))),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + Math.max(0, area.height - height)))),
    width, height
  };
}

module.exports = { validateConfig, visibleBounds };
