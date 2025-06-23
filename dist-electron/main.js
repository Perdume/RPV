const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// 개발 모드 확인
const isDev = process.env.NODE_ENV === 'development';

// 프로젝트 루트 함수 추가
const getProjectRoot = () => {
  return path.resolve(__dirname, '..');
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    // 개발 모드: localhost:3000 로드
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션 모드: 빌드된 파일 로드
    const indexPath = path.join(__dirname, '../dist/index.html');
    
    if (require('fs').existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('빌드된 파일을 찾을 수 없습니다:', indexPath);
      mainWindow.loadURL(`data:text/html,
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1>🚨 빌드된 파일을 찾을 수 없습니다</h1>
            <p>npm run build를 먼저 실행하세요.</p>
          </body>
        </html>
      `);
    }
  }
}

app.whenReady().then(() => {
  // 앱 시작 시 경로 정보 출력
  console.log('\n=== 🗂️ Electron 경로 정보 ===');
  console.log('현재 작업 디렉토리:', process.cwd());
  console.log('앱 경로 (getAppPath):', app.getAppPath());
  console.log('프로젝트 루트:', getProjectRoot());
  console.log('사용자 데이터 경로:', app.getPath('userData'));
  console.log('실행 파일 경로:', process.execPath);
  console.log('__dirname:', __dirname);
  console.log('개발 모드:', isDev);
  console.log('================================\n');
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// === 기본 파일 시스템 핸들러 ===
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const absolutePath = path.resolve(getProjectRoot(), filePath);
    console.log(`[IPC] 파일 읽기: ${filePath} → ${absolutePath}`);
    
    const exists = require('fs').existsSync(absolutePath);
    if (!exists) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }
    
    const content = await fs.readFile(absolutePath, 'utf8');
    console.log(`[IPC] 읽기 성공: ${filePath} (${content.length} bytes)`);
    return content;
  } catch (error) {
    console.error(`[IPC] 읽기 실패: ${filePath}`, error.message);
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    const absolutePath = path.resolve(getProjectRoot(), filePath);
    const dir = path.dirname(absolutePath);
    
    console.log(`[IPC] 파일 쓰기: ${filePath} → ${absolutePath}`);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absolutePath, data, 'utf8');
    console.log(`[IPC] 쓰기 성공: ${filePath} (${data.length} bytes)`);
  } catch (error) {
    console.error(`[IPC] 쓰기 실패: ${filePath}`, error.message);
    throw error;
  }
});

ipcMain.handle('fs:ensureDirectory', async (event, dirPath) => {
  try {
    const absolutePath = path.resolve(getProjectRoot(), dirPath);
    console.log(`[IPC] 디렉토리 생성: ${dirPath} → ${absolutePath}`);
    
    await fs.mkdir(absolutePath, { recursive: true });
    console.log(`[IPC] 디렉토리 생성 완료: ${dirPath}`);
  } catch (error) {
    console.error(`[IPC] 디렉토리 생성 실패: ${dirPath}`, error.message);
    throw error;
  }
});

// === 디버깅용 핸들러 ===
ipcMain.handle('debug:getAllPaths', async () => {
  return {
    cwd: process.cwd(),
    appPath: app.getAppPath(),
    projectRoot: getProjectRoot(),
    userData: app.getPath('userData'),
    execPath: process.execPath,
    __dirname: __dirname,
    isDev: isDev,
    argv: process.argv
  };
});

ipcMain.handle('debug:checkFile', async (event, filePath) => {
  try {
    const absolutePath = path.resolve(getProjectRoot(), filePath);
    const exists = require('fs').existsSync(absolutePath);
    
    if (exists) {
      const stats = require('fs').statSync(absolutePath);
      return {
        exists: true,
        absolutePath,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };
    } else {
      return {
        exists: false,
        absolutePath
      };
    }
  } catch (error) {
    console.error(`[DEBUG] 파일 확인 실패: ${filePath}`, error);
    return {
      exists: false,
      absolutePath: path.resolve(getProjectRoot(), filePath),
      error: error.message
    };
  }
});

ipcMain.handle('debug:listFiles', async (event, dirPath) => {
  try {
    const absolutePath = path.resolve(getProjectRoot(), dirPath);
    const files = await fs.readdir(absolutePath);
    console.log(`[DEBUG] Files in ${dirPath}:`, files);
    return files;
  } catch (error) {
    console.log(`[DEBUG] Directory not found: ${dirPath}`);
    return [];
  }
});