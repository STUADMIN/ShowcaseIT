import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { CaptureManager } from './capture/capture-manager';
import { MouseTracker } from './tracking/mouse-tracker';
import { ClickTracker } from './tracking/click-tracker';

let mainWindow: BrowserWindow | null = null;
let captureManager: CaptureManager | null = null;
let mouseTracker: MouseTracker | null = null;
let clickTracker: ClickTracker | null = null;
let authToken: string | null = null;

const WEB_API_URL = process.env.WEB_API_URL || 'http://localhost:3000/api';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  captureManager = new CaptureManager();
  mouseTracker = new MouseTracker();
  clickTracker = new ClickTracker();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('close-window', () => {
  mainWindow?.close();
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle('start-recording', async (_event, sourceId: string, options?: { trackMouse?: boolean; trackClicks?: boolean }) => {
  if (!captureManager || !mouseTracker || !clickTracker) return { success: false };

  if (options?.trackMouse !== false) {
    mouseTracker.start();
  }
  if (options?.trackClicks !== false) {
    clickTracker.start();
  }

  // Minimize to system tray area so the capture window isn't recorded
  if (mainWindow && !sourceId.startsWith('window:')) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.minimize();
    await new Promise((r) => setTimeout(r, 300));
  }

  await captureManager.startRecording(sourceId);
  return { success: true };
});

ipcMain.handle('stop-recording', async () => {
  if (!captureManager || !mouseTracker || !clickTracker) return null;
  const mouseEvents = mouseTracker.stop();
  const clickEvents = clickTracker.stop();
  const recording = await captureManager.stopRecording();

  if (mainWindow) {
    mainWindow.restore();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.focus();
  }

  return { ...recording, mouseEvents, clickEvents };
});

ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, metadata: Record<string, unknown>) => {
  const outputDir = path.join(app.getPath('userData'), 'recordings');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const videoPath = path.join(outputDir, `recording-${timestamp}.webm`);
  const metaPath = path.join(outputDir, `recording-${timestamp}.json`);

  fs.writeFileSync(videoPath, Buffer.from(buffer));
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

  return { videoPath, metaPath };
});

ipcMain.handle('record-click', (_event, x: number, y: number, button: string) => {
  if (!clickTracker) return;
  clickTracker.recordClick(x, y, button as 'left' | 'right' | 'middle');
});

ipcMain.handle('set-auth-token', (_event, token: string) => {
  authToken = token;
  return { success: true };
});

ipcMain.handle('get-screen-info', () => {
  const displays = screen.getAllDisplays();
  return displays.map((d) => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
  }));
});

ipcMain.handle('upload-to-web', async (_event, buffer: ArrayBuffer, metadata: Record<string, unknown>) => {
  try {
    const boundary = `----ShowcaseIt${Date.now()}`;
    const metaJson = JSON.stringify(metadata);

    const videoBuffer = Buffer.from(buffer);
    const parts: Buffer[] = [];

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="recording.webm"\r\nContent-Type: video/webm\r\n\r\n`));
    parts.push(videoBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n`));
    parts.push(Buffer.from(metaJson));
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${WEB_API_URL}/recordings/upload`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
