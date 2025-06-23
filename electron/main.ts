import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
const path = require('path');
const fs = require('fs').promises;
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

  // 개발 모드에서는 localhost:3000을 로드
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션 모드에서는 빌드된 index.html을 로드
    const indexPath = path.join(__dirname, '..', 'index.html');
    console.log('Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath);
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

// 파일 시스템 IPC 핸들러
ipcMain.handle('fs:writeFile', async (event: IpcMainInvokeEvent, filePath: string, data: string) => {
  try {
    // 프로젝트 루트 기준으로 경로 설정
    const absolutePath = path.resolve(process.cwd(), filePath);
    
    console.log(`[IPC] 파일 쓰기: ${filePath} → ${absolutePath}`);
    
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absolutePath, data, 'utf8');
    console.log(`[IPC] 쓰기 성공: ${filePath}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[IPC] 쓰기 실패: ${filePath}`, err.message);
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (event: IpcMainInvokeEvent, filePath: string) => {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    console.log(`[IPC] 파일 읽기: ${filePath} → ${absolutePath}`);
    
    const data = await fs.readFile(absolutePath, 'utf8');
    console.log(`[IPC] 읽기 성공: ${filePath}`);
    return data;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[IPC] 읽기 실패: ${filePath}`, err.message);
    throw error;
  }
});

ipcMain.handle('fs:ensureDirectory', async (event: IpcMainInvokeEvent, dirPath: string) => {
  try {
    const absolutePath = path.resolve(process.cwd(), dirPath);
    console.log(`[IPC] 디렉토리 생성: ${dirPath} → ${absolutePath}`);
    
    await fs.mkdir(absolutePath, { recursive: true });
    console.log(`[IPC] 디렉토리 생성 성공: ${dirPath}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[IPC] 디렉토리 생성 실패: ${dirPath}`, err.message);
    throw error;
  }
}); 