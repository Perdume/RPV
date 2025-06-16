interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, func: (...args: any[]) => void): void;
    once(channel: string, func: (...args: any[]) => void): void;
    removeListener(channel: string, func: (...args: any[]) => void): void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    fs?: {
      readFile(path: string, options: { encoding: string }): Promise<string>;
      writeFile(path: string, data: string, options: { encoding: string }): Promise<void>;
    };
  }
} 