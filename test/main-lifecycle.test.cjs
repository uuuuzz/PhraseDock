'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main.cjs'), 'utf8');
const defaults = require('../config/phrases.json');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture(platform = 'win32', brokenConfig = false) {
  const windows = [], handlers = new Map(), messages = [];
  const app = new EventEmitter();
  const appPaths = { appData: 'virtual-user-data' };
  let draining;
  const adapter = { configured: null, inserts: 0, status: async () => ({ ok: true, ready: true, code: 'ready', message: 'ready', pid: 42, targetKey: 'first' }),
    insert: async () => { adapter.inserts++; return { ok: true, verified: true, code: 'inserted', message: 'done' }; },
    configure(target) { adapter.configured = target; }, close: () => new Promise(resolve => { draining = resolve; }) };
  Object.assign(app, { setName(value){app.displayName = value;}, requestSingleInstanceLock: () => true, whenReady: async () => {},
    setPath(name, value){appPaths[name] = value;},
    setAppUserModelId(){}, getPath: name => appPaths[name], getAppPath: () => root, getVersion: () => require('../package.json').version, isPackaged: false,
    dock: { hide(){} }, quit() { const event = { prevented: false, preventDefault(){this.prevented = true;} }; app.emit('before-quit', event); app.lastQuit = event; } });
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.bounds = options; this.visible = false;
      this.webContents = new EventEmitter(); Object.assign(this.webContents, { setWindowOpenHandler(){}, send: (...args) => messages.push(args) }); windows.push(this); }
    setAlwaysOnTop(){} setVisibleOnAllWorkspaces(){} setIgnoreMouseEvents(){}
    getBounds(){return this.bounds;} setBounds(bounds){this.bounds = bounds;}
    isDestroyed(){return false;} isVisible(){return this.visible;} hide(){this.visible = false;}
    showInactive(){this.visible = true;} show(){this.visible = true;} async loadFile(){}
    getNativeWindowHandle(){const bytes = Buffer.alloc(8); bytes.writeBigUInt64LE(5678n); return bytes;}
  }
  const screen = new EventEmitter(); screen.getAllDisplays = () => [{workArea: {x:0,y:0,width:1440,height:900}}];
  const nativeImage = {createFromBitmap: () => ({setTemplateImage(){}}), createFromPath: file => ({file})};
  class Tray extends EventEmitter { setToolTip(){} setContextMenu(){} }
  const electron = { app, BrowserWindow: Window, ipcMain: {handle: (name, fn) => handlers.set(name, fn)}, screen, nativeImage, Tray,
    Menu: {buildFromTemplate: () => ({popup(){}})}, shell: {openPath: async () => '', openExternal: async () => {}}, systemPreferences: {isTrustedAccessibilityClient(){}} };
  const fakeFs = {mkdirSync(){}, existsSync: () => true, writeFileSync(){}, readFileSync(file) {
    if (file.endsWith('window.json')) throw new Error('not saved');
    if (brokenConfig && file.includes('virtual-user-data')) return 'invalid';
    return JSON.stringify(defaults);
  }};
  vm.runInNewContext(source, {require(name) {
    if (name === 'electron') return electron;
    if (name === 'node:fs') return fakeFs;
    if (name === './platform/index.cjs') return {createPlatform: () => adapter};
    if (name.startsWith('./core/')) return require(path.join(root, 'src', name));
    return require(name);
  }, __dirname: path.join(root, 'src'), process: {platform, pid:100}, console, Buffer,
  setTimeout: () => 1, clearTimeout(){}, setInterval: () => 1, clearInterval(){} });
  await tick(); await tick();
  const invoke = (name, ...args) => handlers.get(name)({sender:windows[0].webContents}, ...args);
  return {windows, handlers, messages, adapter, app, invoke, finishClose: () => draining()};
}
test('both platform window definitions retain sandbox, no focus and shared UI dimensions', async () => {
  for (const platform of ['win32', 'darwin']) {
    const f = await fixture(platform); const options = f.windows[0].options;
    assert.equal(options.focusable, false); assert.equal(options.width, 72); assert.equal(options.height, 72);
    assert.equal(options.webPreferences.nodeIntegration, false);
    assert.equal(options.webPreferences.sandbox, true); assert.equal(options.webPreferences.contextIsolation, true);
    assert.equal(f.app.getPath('userData'), path.join('virtual-user-data', 'PhraseDock'));
    assert.equal(f.app.getPath('sessionData'), f.app.getPath('userData'));
    if (platform === 'win32') assert.ok(options.icon.endsWith('PhraseDock.ico'));
    else assert.equal(options.type, 'panel');
  }
});
test('input fixture is authorized by exact HWND and owning PID, not Electron executable', async () => {
  const f = await fixture(); await f.invoke('app:test');
  assert.equal(f.adapter.configured.fixtureHwnd, '5678');
  assert.equal(f.adapter.configured.fixturePid, 100);
  assert.deepEqual([...f.adapter.configured.windowsExecutables], ['codex.exe']);
  assert.deepEqual([...f.adapter.configured.windowsPackageFamilyNames], ['openai.codex_2p2nqsd0c76g0']);
  f.windows[1].emit('closed'); assert.equal(f.adapter.configured.fixtureHwnd, undefined);
});
test('main rejects an unexpected queue target and foreign IPC sender', async () => {
  const f = await fixture();
  assert.equal((await f.invoke('phrase:insert', defaults.phrases[0].id, 'other')).code, 'focus-changed');
  assert.equal(f.adapter.inserts, 0);
  assert.throws(() => f.handlers.get('app:initial')({sender:{}}), /Untrusted/);
});
test('startup configuration errors expand the panel before presenting their notice', async () => {
  const f = await fixture('win32', true);
  assert.ok(f.windows[0].bounds.height > 72);
  assert.ok(f.messages.findIndex(x => x[0] === 'menu:set-expanded') < f.messages.findIndex(x => x[0] === 'phrase:result'));
});
test('quit waits for native cleanup instead of ending the application immediately', async () => {
  const f = await fixture(); f.app.quit(); assert.equal(f.app.lastQuit.prevented, true);
  f.finishClose(); await tick(); assert.equal(f.app.lastQuit.prevented, false);
});
