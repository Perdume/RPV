import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname과 __filename 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 개발 모드 확인
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 개발 모드에서는 localhost:3000으로, 프로덕션 모드에서는 index.html로 로드
  const startUrl = isDev 
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 개발 모드에서 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

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

// 파일 시스템 핸들러 등록
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const absolutePath = path.resolve(app.getAppPath(), filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`파일 읽기 실패 (${filePath}):`, error);
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    const absolutePath = path.resolve(app.getAppPath(), filePath);
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absolutePath, data, 'utf8');
  } catch (error) {
    console.error(`파일 쓰기 실패 (${filePath}):`, error);
    throw error;
  }
}); 