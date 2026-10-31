'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linsssside', {
  call: (method, payload) => ipcRenderer.invoke('api:call', method, payload),
  notifyTest: () => ipcRenderer.invoke('api:notify-test'),
  onFocus: (cb) => {
    ipcRenderer.on('app:focus', (_event, data) => cb(data));
  },
  platform: process.platform,
});
