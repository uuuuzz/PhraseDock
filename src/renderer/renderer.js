'use strict';

const api = window.phraseDock;
const phraseList = document.getElementById('phrases');
const hub = document.getElementById('hub');
const toast = document.getElementById('toast');
let processing = false;
let toggling = false;
let expanded = false;
let toastTimer;
let ignoringMouse = false;
let stateText = '等待输入光标';
const insertionQueue = [];
const pendingCounts = new Map();

// Keep the keyboard focus in the target editor.
document.addEventListener('mousedown', event => {
  if (event.target.closest('button')) event.preventDefault();
});

function setPointerPassthrough(ignore) {
  if (ignoringMouse === ignore) return;
  ignoringMouse = ignore;
  api.pointerPassthrough(ignore);
}

document.addEventListener('mousemove', event => {
  const interactive = event.target.closest('.phrase, .hub-button, .drag-ring');
  setPointerPassthrough(expanded && !interactive);
});
document.addEventListener('mouseleave', () => setPointerPassthrough(expanded));

function displayState(value) {
  document.body.classList.toggle('ready', Boolean(value.ready));
  document.body.classList.toggle('permission', value.code === 'permission');
  stateText = value.ready ? `${value.appName || '当前应用'} 输入框已就绪` :
    value.message || '等待输入光标';
  hub.title = `${stateText}；点击${expanded ? '收起' : '展开'}，拖动外圈移动`;
}

function showToast(value) {
  if (!value?.message) return;
  clearTimeout(toastTimer);
  toast.textContent = value.message;
  toast.className = `toast visible ${value.code === 'inserted' ? 'success' : value.ok === false ? 'error' : ''}`;
  toast.setAttribute('aria-hidden', 'false');
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    toast.setAttribute('aria-hidden', 'true');
  }, value.ok ? 1400 : 2800);
}

function installPressFeedback(button) {
  let pressedAt = 0;
  let releaseTimer;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    clearTimeout(releaseTimer);
    pressedAt = performance.now();
    button.classList.add('pressed');
  });
  const release = () => {
    const remaining = Math.max(0, 72 - (performance.now() - pressedAt));
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => button.classList.remove('pressed'), remaining);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

function updatePending(button, delta) {
  const count = Math.max(0, (pendingCounts.get(button) || 0) + delta);
  if (count) pendingCounts.set(button, count);
  else pendingCounts.delete(button);
  button.classList.toggle('pending', count > 0);
}

async function processInsertionQueue() {
  if (processing) return;
  processing = true;
  let expectedTarget;
  while (insertionQueue.length) {
    const item = insertionQueue.shift();
    item.button.classList.add('processing');
    let result;
    try {
      result = await api.insert(item.id, expectedTarget);
    } catch {
      result = { ok: false, code: 'failed', message: '操作未完成，请重新点击输入框。' };
    }
    item.button.classList.remove('processing');
    updatePending(item.button, -1);
    displayState(result);
    if (result.code === 'inserted') {
      item.button.classList.add('inserted');
      setTimeout(() => item.button.classList.remove('inserted'), 500);
    }
    if (!result.ok || result.verified !== true || result.code !== 'inserted') {
      while (insertionQueue.length) updatePending(insertionQueue.shift().button, -1);
      showToast(result);
      break;
    }
    expectedTarget = result.targetKey;
    if (!insertionQueue.length) showToast(result);
  }
  processing = false;
}

function enqueueInsertion(id, button) {
  if (insertionQueue.length + (processing ? 1 : 0) >= 8) {
    showToast({ ok: false, message: '点击过快，请稍候再试。' });
    return;
  }
  updatePending(button, 1);
  insertionQueue.push({ id, button });
  processInsertionQueue();
}

function renderPhrases(phrases, layout) {
  phraseList.replaceChildren();
  phrases.forEach((phrase, index) => {
    const position = layout.positions[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phrase';
    button.dataset.phraseId = phrase.id;
    button.title = phrase.text;
    button.setAttribute('aria-label', phrase.label);
    button.tabIndex = -1;
    button.style.setProperty('--button-width', `${layout.buttonWidth}px`);
    button.style.setProperty('--x', `${position.x}px`);
    button.style.setProperty('--y', `${position.y}px`);
    button.style.setProperty('--delay', `${index * 8}ms`);
    const number = document.createElement('span');
    number.className = 'number';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = phrase.label;
    button.append(number, label);
    installPressFeedback(button);
    button.addEventListener('click', () => {
      if (!toggling) enqueueInsertion(phrase.id, button);
    });
    phraseList.append(button);
  });
}

function applyExpanded(value) {
  expanded = value;
  document.body.classList.toggle('expanded', expanded);
  phraseList.inert = !expanded;
  phraseList.setAttribute('aria-hidden', String(!expanded));
  hub.setAttribute('aria-expanded', String(expanded));
  hub.setAttribute('aria-label', expanded ? '收起快捷提示词' : '展开快捷提示词');
  hub.title = `${stateText}；点击${expanded ? '收起' : '展开'}，拖动外圈移动`;
  if (!expanded) setPointerPassthrough(false);
}

hub.addEventListener('click', async () => {
  if (toggling) return;
  if (processing || insertionQueue.length) {
    showToast({ message: '正在完成已点击的提示词…' });
    return;
  }
  toggling = true;
  try {
    if (!expanded) {
      await api.setExpanded(true);
      requestAnimationFrame(() => applyExpanded(true));
    } else {
      applyExpanded(false);
      await new Promise(resolve => setTimeout(resolve, 155));
      await api.setExpanded(false);
    }
  } finally { toggling = false; }
});
installPressFeedback(hub);
hub.addEventListener('contextmenu', event => { event.preventDefault(); api.showMenu(); });

api.onStatus(value => { if (!processing) displayState(value); });
api.onResult(value => { displayState(value); showToast(value); });
api.onConfig(({ phrases, layout }) => {
  while (insertionQueue.length) updatePending(insertionQueue.shift().button, -1);
  renderPhrases(phrases, layout);
});
api.onExpanded(value => applyExpanded(value));
api.initial().then(value => {
  renderPhrases(value.phrases, value.layout);
  applyExpanded(Boolean(value.expanded));
});
