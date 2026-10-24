import { contextBridge, ipcRenderer } from 'electron';

const api = {
  ipcRenderer: {
    send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
    on: (channel: string, func: Function) =>
      ipcRenderer.on(channel, (_event, ...args) => func(...args)),
    once: (channel: string, func: Function) =>
      ipcRenderer.once(channel, (_event, ...args) => func(...args)),
    invoke: (channel: string, data?: any) =>
      ipcRenderer.invoke(channel, data),
  },
};

contextBridge.exposeInMainWorld('electron', api);

declare global {
  interface Window {
    electron: typeof api;
  }
}

export {};
