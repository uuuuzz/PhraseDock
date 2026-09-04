'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, listener) => {
  const handler = (_event, value) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('phraseDock', Object.freeze({
  initial: () => ipcRenderer.invoke('app:initial'),
  insert: id => ipcRenderer.invoke('phrase:insert', id),
  permission: () => ipcRenderer.invoke('app:permission'),
  config: () => ipcRenderer.invoke('app:config'),
  reload: () => ipcRenderer.invoke('app:reload'),
  setExpanded: value => ipcRenderer.invoke('app:expanded', value),
  pointerPassthrough: ignore => ipcRenderer.invoke('window:pointer', ignore),
  showMenu: () => ipcRenderer.invoke('app:menu'),
  hide: () => ipcRenderer.invoke('app:hide'),
  test: () => ipcRenderer.invoke('app:test'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onStatus: listener => subscribe('platform:status', listener),
  onResult: listener => subscribe('phrase:result', listener),
  onConfig: listener => subscribe('config:updated', listener),
  onExpanded: listener => subscribe('menu:set-expanded', listener)
}));
