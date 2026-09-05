'use strict';

function validateConfig(value) {
  if (!value || value.schemaVersion !== 1) throw new Error('schemaVersion 必须为 1。');
  const bundleIds = value.target?.macBundleIds;
  if (!Array.isArray(bundleIds) || bundleIds.length < 1 || bundleIds.length > 16 ||
      bundleIds.some(id => typeof id !== 'string' || !/^[\w.-]{3,160}$/.test(id))) {
    throw new Error('target.macBundleIds 必须是有效的应用标识列表。');
  }
  // Old macOS files remain valid; defaults are applied in memory only.
  const windowsExecutables = value.target.windowsExecutables ?? ['Codex.exe'];
  if (!Array.isArray(windowsExecutables) || windowsExecutables.length < 1 || windowsExecutables.length > 16 ||
      windowsExecutables.some(name => typeof name !== 'string' || name.trim() !== name || !/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,120}\.exe$/i.test(name))) {
    throw new Error('target.windowsExecutables 必须是有效的 exe 文件名列表。');
  }
  // The Store-distributed Codex desktop app currently hosts its window in
  // ChatGPT.exe. Match its stable OS package identity, not that shared filename.
  const windowsPackageFamilyNames = value.target.windowsPackageFamilyNames ?? ['OpenAI.Codex_2p2nqsd0c76g0'];
  if (!Array.isArray(windowsPackageFamilyNames) || windowsPackageFamilyNames.length > 16 ||
      windowsPackageFamilyNames.some(name => typeof name !== 'string' || name.trim() !== name ||
        !/^[a-zA-Z0-9][a-zA-Z0-9.-]{2,49}_[a-zA-Z0-9]{13}$/.test(name))) {
    throw new Error('target.windowsPackageFamilyNames 必须是有效的 Windows 程序包系列名称列表。');
  }
  if (!Array.isArray(value.phrases) || value.phrases.length < 1 || value.phrases.length > 12) {
    throw new Error('请配置 1～12 个提示词。');
  }
  const ids = new Set();
  const phrases = value.phrases.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(item.id) || ids.has(item.id)) {
      throw new Error('提示词 id 只能包含英文、数字、横线、下划线，且不能重复。');
    }
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 16) {
      throw new Error('按钮名称不能为空，且不能超过 16 个字符。');
    }
    if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 8000 || item.text.includes('\0')) {
      throw new Error('提示词内容不能为空，不能包含空字符，最多 8000 个字符。');
    }
    ids.add(item.id);
    return { id: item.id, label: item.label.trim(), text: item.text };
  });
  return { schemaVersion: 1, target: { macBundleIds: [...new Set(bundleIds)],
    windowsExecutables: [...new Set(windowsExecutables.map(name => name.toLowerCase()))],
    windowsPackageFamilyNames: [...new Set(windowsPackageFamilyNames.map(name => name.toLowerCase()))] }, phrases };
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
