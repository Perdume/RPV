// window.fs API 초기화
export function initFileSystem() {
  if (!window.fs) {
    const fs = {
      async readFile(path: string, options: { encoding: string }): Promise<string> {
        if (!window.electron?.ipcRenderer) {
          throw new Error('Electron not initialized');
        }
        try {
          const content = await window.electron.ipcRenderer.invoke('fs:readFile', path);
          return content;
        } catch (error) {
          console.error(`파일 읽기 실패 (${path}):`, error);
          throw error;
        }
      },

      async writeFile(path: string, data: string, options: { encoding: string }): Promise<void> {
        if (!window.electron?.ipcRenderer) {
          throw new Error('Electron not initialized');
        }
        try {
          await window.electron.ipcRenderer.invoke('fs:writeFile', path, data);
        } catch (error) {
          console.error(`파일 쓰기 실패 (${path}):`, error);
          throw error;
        }
      },

      async ensureDirectory(path: string): Promise<void> {
        if (!window.electron?.ipcRenderer) {
          throw new Error('Electron not initialized');
        }
        try {
          await window.electron.ipcRenderer.invoke('fs:ensureDirectory', path);
        } catch (error) {
          console.error(`디렉토리 생성 실패 (${path}):`, error);
          throw error;
        }
      }
    };

    window.fs = fs;

    // 기본 디렉토리 구조 생성
    const initDirectories = async () => {
      if (!window.electron?.ipcRenderer) {
        console.warn('Electron not initialized, skipping directory initialization');
        return;
      }

      const dirs = [
        'Data',
        'src/data/abilities',
        'src/data/records',
        'src/data/history'
      ];

      for (const dir of dirs) {
        await fs.ensureDirectory(dir);
      }

      // 기본 게임 세션 데이터 생성
      try {
        await fs.readFile('Data/data.json', { encoding: 'utf8' });
      } catch (error) {
        const defaultData = {
          players: [],
          currentTurn: 0,
          lastUpdated: new Date().toISOString()
        };
        await fs.writeFile('Data/data.json', JSON.stringify(defaultData, null, 2), { encoding: 'utf8' });
      }
    };

    initDirectories().catch(console.error);
  }
} 