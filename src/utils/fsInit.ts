import { ipcRenderer } from 'electron';

// window.fs API 초기화
export function initFileSystem() {
  if (!window.fs) {
    window.fs = {
      async readFile(path: string, options: { encoding: string }): Promise<string> {
        try {
          const content = await ipcRenderer.invoke('fs:readFile', path);
          return content;
        } catch (error) {
          console.error(`파일 읽기 실패 (${path}):`, error);
          throw error;
        }
      },

      async writeFile(path: string, data: string, options: { encoding: string }): Promise<void> {
        try {
          await ipcRenderer.invoke('fs:writeFile', path, data);
        } catch (error) {
          console.error(`파일 쓰기 실패 (${path}):`, error);
          throw error;
        }
      }
    };
  }
} 