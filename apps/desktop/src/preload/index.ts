import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getSources: () => ipcRenderer.invoke('get-sources'),
  startRecording: (sourceId: string, options: { trackMouse: boolean; trackClicks: boolean }) =>
    ipcRenderer.invoke('start-recording', sourceId, options),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  saveRecording: (buffer: ArrayBuffer, metadata: Record<string, unknown>) =>
    ipcRenderer.invoke('save-recording', buffer, metadata),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),
  recordClick: (x: number, y: number, button: string) =>
    ipcRenderer.invoke('record-click', x, y, button),
  uploadToWeb: (buffer: ArrayBuffer, metadata: Record<string, unknown>) =>
    ipcRenderer.invoke('upload-to-web', buffer, metadata),
  setAuthToken: (token: string) =>
    ipcRenderer.invoke('set-auth-token', token),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onRecordingStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('recording-status', (_event, status) => callback(status));
  },
};

contextBridge.exposeInMainWorld('showcaseit', api);
