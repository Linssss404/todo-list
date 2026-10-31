'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linsssside', {
  call: (method, payload) => ipcRenderer.invoke('api:call', method, payload),
  notifyTest: () => ipcRenderer.invoke('api:notify-test'),
  hideQuick: () => ipcRenderer.invoke('quick:hide'),
  openQuick: () => ipcRenderer.invoke('window:quick-open'),
  onQuickReset: (cb) => ipcRenderer.on('quick:reset', () => cb()),
  onFocus: (cb) => {
    ipcRenderer.on('app:focus', (_event, data) => cb(data));
  },
  platform: process.platform,
});
