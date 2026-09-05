'use strict';

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { validateConfig } = require('./core/config.cjs');
const { COLLAPSED_SIZE, radialLayout, boundsAroundAnchor, restoreAnchor } = require('./core/radial-layout.cjs');
const { createPlatform } = require('./platform/index.cjs');
const { productName, productNameZh } = require('../package.json');
const applicationTitle = `${productNameZh} · ${productName}`;

// Keep configuration and single-instance identity stable across display renames.
const userDataDirectory = path.join(app.getPath('appData'), 'PhraseDock');
fs.mkdirSync(userDataDirectory, { recursive: true });
app.setPath('userData', userDataDirectory);
app.setPath('sessionData', userDataDirectory);
app.setName(productName);
if (!app.requestSingleInstanceLock()) { app.quit(); }
else { app.whenReady().then(start).catch(error => { console.error(error.message); app.quit(); }); }

let panel, tray, adapter, fixture, config, configFile, positionFile, anchor, layout;
let lastStatus = null, inserting = false, noticeUntil = 0, expanded = false;
let quitRequested = false, closing = false, drained = false;
let saveTimer, pollTimer;

function resultNotice(result, duration = 2000) {
  noticeUntil = Date.now() + duration;
  if (!panel || panel.isDestroyed()) return;
  // Reveal notices inside the visible menu; a collapsed 72px panel clips them.
  if (!expanded && panel && !panel.isDestroyed()) {
    setExpanded(true);
    panel.webContents.send('menu:set-expanded', true);
  }
  panel?.webContents.send('phrase:result', result);
}
function handle(channel, callback) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== panel?.webContents) throw new Error('Untrusted window.');
    return callback(...args);
  });
}
function configureAdapter() {
  const target = { macBundleIds: [...config.target.macBundleIds], windowsExecutables: [...config.target.windowsExecutables],
    windowsPackageFamilyNames: [...config.target.windowsPackageFamilyNames] };
  if (fixture && !fixture.isDestroyed()) {
    target.macBundleIds.push(app.isPackaged ? 'com.phrasedock.desktop' : 'com.github.Electron');
    if (process.platform === 'win32') {
      const handle = fixture.getNativeWindowHandle();
      target.fixtureHwnd = (handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString();
      target.fixturePid = process.pid;
    }
  }
  adapter.configure(target);
}
function readConfig() {
  // Parse completely before swapping; a broken edit leaves the current buttons working.
  const next = validateConfig(JSON.parse(fs.readFileSync(configFile, 'utf8')));
  config = next;
  configureAdapter();
  return config;
}
function workAreas() { return screen.getAllDisplays().map(display => display.workArea); }
function currentSize() { return expanded ? { width: layout.width, height: layout.height } : COLLAPSED_SIZE; }
function saveAnchorSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (anchor) {
      try { fs.writeFileSync(positionFile, JSON.stringify({ version: 2, x: anchor.x, y: anchor.y })); }
      catch { resultNotice({ ok: false, code: 'position', message: '窗口位置暂时无法保存。' }); }
    }
  }, 250);
}
function applyPanelBounds() {
  const resolved = boundsAroundAnchor(anchor, currentSize(), workAreas());
  anchor = resolved.anchor;
  panel.setBounds(resolved.bounds);
  saveAnchorSoon();
}
function setExpanded(value) {
  expanded = Boolean(value);
  applyPanelBounds();
  return { expanded, layout };
}
async function poll() {
  if (inserting || closing || !panel || panel.isDestroyed() || !panel.isVisible()) return;
  const value = await adapter.status();
  lastStatus = value;
  if (Date.now() > noticeUntil && !panel.isDestroyed()) panel.webContents.send('platform:status', value);
}
function resizePanel() {
  applyPanelBounds();
}
function showPanel() {
  panel.showInactive();
  poll();
}

async function start() {
  if (process.platform === 'win32') app.setAppUserModelId('com.phrasedock.desktop');
  const dataDir = app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });
  configFile = path.join(dataDir, 'phrases.json');
  positionFile = path.join(dataDir, 'window.json');
  const defaultFile = path.join(app.getAppPath(), 'config/phrases.json');
  if (!fs.existsSync(configFile)) fs.copyFileSync(defaultFile, configFile);
  let configProblem = '';
  try { config = validateConfig(JSON.parse(fs.readFileSync(configFile, 'utf8'))); }
  catch (error) { config = validateConfig(JSON.parse(fs.readFileSync(defaultFile, 'utf8'))); configProblem = error.message; }
  adapter = createPlatform({
    platform: process.platform,
    helperPath: process.platform === 'win32'
      ? path.join(app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'build'), 'windows', 'PhraseBridge.exe')
      : app.isPackaged ? path.join(process.resourcesPath, 'PhraseBridge') : path.join(app.getAppPath(), 'build/PhraseBridge'),
    target: config.target
  });
  let saved;
  try { saved = JSON.parse(fs.readFileSync(positionFile, 'utf8')); } catch {}
  layout = radialLayout(config.phrases.length);
  anchor = restoreAnchor(saved, workAreas());
  panel = new BrowserWindow({
    ...boundsAroundAnchor(anchor, COLLAPSED_SIZE, workAreas()).bounds,
    title: applicationTitle, frame: false, show: false, transparent: true,
    backgroundColor: '#00000000', resizable: false, maximizable: false, minimizable: false,
    fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false,
    acceptFirstMouse: true, hasShadow: false,
    ...(process.platform === 'win32' ? { icon: path.join(app.getAppPath(), 'resources/icons/PhraseDock.ico'), thickFrame: false } : {}),
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, spellcheck: false }
  });
  panel.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') {
    app.dock.hide();
    panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  panel.webContents.on('will-navigate', event => event.preventDefault());
  panel.on('moved', () => {
    if (panel.isDestroyed()) return;
    const bounds = panel.getBounds();
    anchor = { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) };
    saveAnchorSoon();
  });
  screen.on('display-removed', resizePanel);
  screen.on('display-metrics-changed', resizePanel);

  handle('app:initial', () => ({ phrases: config.phrases, layout, expanded, platform: process.platform, version: app.getVersion() }));
  handle('phrase:insert', async (id, expectedTarget) => {
    if (inserting || closing) return { ok: false, code: 'busy', message: '正在插入上一段提示词。' };
    if (expectedTarget !== undefined && (typeof expectedTarget !== 'string' || expectedTarget.length > 2048)) {
      return { ok: false, code: 'invalid', message: '输入目标无效。' };
    }
    const phrase = config.phrases.find(item => item.id === id);
    if (!phrase) return { ok: false, code: 'invalid', message: '提示词不存在，请重新加载配置。' };
    inserting = true;
    try {
      // Check now, not only against the possibly stale status shown in the UI.
      const status = await adapter.status();
      lastStatus = status;
      if (status.ready && expectedTarget && expectedTarget !== (status.targetKey || String(status.pid))) {
        return { ok: false, ready: false, code: 'focus-changed', message: '输入目标已切换，后续提示词已停止。' };
      }
      const result = status.ready ? await adapter.insert(phrase.text, status.pid, status.targetKey) : status;
      if (result.ok && !result.targetKey) result.targetKey = String(status.pid);
      return result;
    } finally {
      inserting = false;
      if (quitRequested) app.quit();
    }
  });
  handle('app:permission', async () => {
    if (process.platform !== 'darwin') return;
    systemPreferences.isTrustedAccessibilityClient(true);
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    resultNotice({ ok: false, code: 'permission', message: `打开 ${productName} 的辅助功能开关，再回到输入框。` }, 5000);
  });
  handle('app:config', async () => {
    const error = await shell.openPath(configFile);
    if (error) shell.showItemInFolder(configFile);
    return { ok: !error };
  });
  handle('app:reload', reloadPhrases);
  handle('app:expanded', value => { if (typeof value === 'boolean') return setExpanded(value); });
  handle('window:pointer', ignore => { if (typeof ignore === 'boolean') panel.setIgnoreMouseEvents(ignore, { forward: true }); });
  handle('app:menu', () => showHubMenu());
  handle('app:hide', () => hidePanel());
  handle('app:test', () => openFixture());
  handle('app:quit', () => app.quit());

  await panel.loadFile(path.join(__dirname, 'renderer/index.html'));
  showPanel();
  if (configProblem) resultNotice({ ok: false, code: 'config', message: `配置有误，暂用默认提示词：${configProblem}` }, 7000);
  createTray();
  pollTimer = setInterval(poll, 1100);
  app.on('second-instance', showPanel);
  app.on('activate', showPanel);
}

function hidePanel() {
  if (expanded) {
    setExpanded(false);
    panel.webContents.send('menu:set-expanded', false);
  }
  panel.setIgnoreMouseEvents(false);
  panel.hide();
}

function reloadPhrases() {
  try {
    readConfig();
    layout = radialLayout(config.phrases.length);
    resizePanel();
    panel.webContents.send('config:updated', { phrases: config.phrases, layout });
    resultNotice({ ok: true, code: 'reloaded', message: '提示词已重新加载。' });
  } catch (error) { resultNotice({ ok: false, code: 'config', message: error.message }, 6000); }
}

function permissionSettings() {
  if (process.platform !== 'darwin') return;
  systemPreferences.isTrustedAccessibilityClient(true);
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
}

function utilityMenu() {
  return [
    { label: '编辑提示词配置', click: () => shell.openPath(configFile) },
    { label: '重新加载提示词', click: reloadPhrases },
    { label: '打开输入测试', click: openFixture },
    ...(process.platform === 'darwin' ? [{ label: '打开辅助功能设置', click: permissionSettings }] : []),
    { type: 'separator' },
    { label: `隐藏 ${productNameZh}`, click: hidePanel },
    { label: `退出 ${productNameZh}`, click: () => app.quit() }
  ];
}

function showHubMenu() {
  panel.setIgnoreMouseEvents(false);
  Menu.buildFromTemplate(utilityMenu()).popup({ window: panel });
}

function createTray() {
  // Tiny monochrome speech bubble, drawn as a native template bitmap.
  const pixels = Buffer.alloc(22 * 22 * 4);
  for (let y = 3; y < 20; y++) for (let x = 3; x < 19; x++) {
    const body = y < 16;
    const tail = y >= 16 && x >= 6 && x < 11 - (y - 16);
    const line = ((y === 7 || y === 8) && x >= 6 && x < 16) || ((y === 11 || y === 12) && x >= 6 && x < 13);
    if ((body || tail) && !line) pixels[(y * 22 + x) * 4 + 3] = 255;
  }
  const icon = process.platform === 'win32'
    ? nativeImage.createFromPath(path.join(app.getAppPath(), 'resources/icons/PhraseDock.ico'))
    : nativeImage.createFromBitmap(pixels, { width: 22, height: 22, scaleFactor: 1 });
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip(applicationTitle);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `显示 ${productNameZh}`, click: showPanel },
    { type: 'separator' },
    ...utilityMenu()
  ]));
  tray.on('click', showPanel);
}

function openFixture() {
  if (fixture && !fixture.isDestroyed()) { fixture.show(); return; }
  fixture = new BrowserWindow({
    width: 640, height: 460, title: `${productNameZh} · 输入测试`,
    autoHideMenuBar: true,
    ...(process.platform === 'win32' ? { icon: path.join(app.getAppPath(), 'resources/icons/PhraseDock.ico') } : {}),
    backgroundColor: '#f4f5f1', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  configureAdapter();
  fixture.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  fixture.webContents.on('will-navigate', event => event.preventDefault());
  fixture.loadFile(path.join(__dirname, 'renderer/test-input.html'));
  fixture.on('closed', () => { fixture = null; configureAdapter(); });
  showPanel();
}

app.on('before-quit', event => {
  // Let an in-flight paste restore the clipboard before ending the native process.
  if (inserting) { quitRequested = true; event.preventDefault(); return; }
  if (!drained && adapter) {
    event.preventDefault();
    if (!closing) {
      closing = true;
      resultNotice({ ok: false, code: 'closing', message: '正在结束输入组件并恢复剪贴板…' });
      Promise.resolve(adapter.close()).then(() => { drained = true; app.quit(); });
    }
    return;
  }
  clearTimeout(saveTimer); clearInterval(pollTimer);
});
app.on('window-all-closed', () => app.quit());
