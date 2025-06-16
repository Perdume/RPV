// window.fs API 초기화
export function initFileSystem() {
  if (!window.fs) {
    const fs = {
      async readFile(path: string, options: { encoding: string }): Promise<string> {
        // Electron 환경이 아닐 때는 fetch 사용
        if (!window.electron?.ipcRenderer) {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(`파일을 찾을 수 없습니다: ${path}`);
          }
          return await response.text();
        }
        
        // Electron 환경일 때
        try {
          const content = await window.electron.ipcRenderer.invoke('fs:readFile', path);
          return content;
        } catch (error) {
          console.error(`파일 읽기 실패 (${path}):`, error);
          throw error;
        }
      },

      async writeFile(path: string, data: string, options: { encoding: string }): Promise<void> {
        // 웹 환경에서는 localStorage 사용
        if (!window.electron?.ipcRenderer) {
          localStorage.setItem(`file:${path}`, data);
          return;
        }
        
        // Electron 환경일 때
        try {
          await window.electron.ipcRenderer.invoke('fs:writeFile', path, data);
        } catch (error) {
          console.error(`파일 쓰기 실패 (${path}):`, error);
          throw error;
        }
      },

      async ensureDirectory(path: string): Promise<void> {
        if (!window.electron?.ipcRenderer) {
          // 웹 환경에서는 아무것도 하지 않음
          return;
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
        console.warn('웹 환경에서는 디렉토리 초기화를 건너뜁니다.');
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