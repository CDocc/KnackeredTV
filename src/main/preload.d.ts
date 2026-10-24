declare const api: {
    ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: Function) => Electron.IpcRenderer;
        once: (channel: string, func: Function) => Electron.IpcRenderer;
        invoke: (channel: string, data?: any) => Promise<any>;
    };
};
declare global {
    interface Window {
        electron: typeof api;
    }
}
export {};
//# sourceMappingURL=preload.d.ts.map