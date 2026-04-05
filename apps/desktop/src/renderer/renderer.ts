export {};

declare global {
  interface Window {
    showcaseit: {
      getSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
      startRecording: (
        sourceId: string,
        options: { trackMouse: boolean; trackClicks: boolean }
      ) => Promise<{ success: boolean }>;
      stopRecording: () => Promise<{
        filePath: string;
        duration: number;
        width: number;
        height: number;
        mouseEvents: Array<{ x: number; y: number; timestamp: number }>;
        clickEvents: Array<{ x: number; y: number; timestamp: number; button: string }>;
      }>;
      saveRecording: (
        buffer: ArrayBuffer,
        metadata: Record<string, unknown>
      ) => Promise<{ videoPath: string; metaPath: string }>;
      getScreenInfo: () => Promise<any>;
      recordClick: (x: number, y: number, button: string) => Promise<void>;
      uploadToWeb: (
        buffer: ArrayBuffer,
        metadata: Record<string, unknown>
      ) => Promise<{ success: boolean; data?: any }>;
      setAuthToken: (token: string) => Promise<{ success: boolean }>;
      minimizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      onRecordingStatus: (callback: (status: string) => void) => void;
    };
  }
}

let selectedSourceId: string | null = null;
let selectedSourceName: string | null = null;
let isRecording = false;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let lastRecordingBuffer: ArrayBuffer | null = null;
let lastRecordingMetadata: Record<string, unknown> | null = null;
/** Mic audio was muxed into the last completed recording (library mode + voiceover on). */
let lastRecordingHadVoiceover = false;
/** Purpose selected when recording started (metadata / upload). */
let lastRecordingPurpose: 'guide' | 'library' = 'guide';

const sourcesGrid = document.getElementById('sources-grid')!;
const btnRecord = document.getElementById('btn-record')!;
const btnStop = document.getElementById('btn-stop')!;
const btnUpload = document.getElementById('btn-upload')!;
const recordingIndicator = document.getElementById('recording-indicator')!;
const timerDisplay = document.getElementById('timer')!;
const statusMessage = document.getElementById('status-message')!;
const toggleMouse = document.getElementById('toggle-mouse') as HTMLInputElement;
const toggleClicks = document.getElementById('toggle-clicks') as HTMLInputElement;
const toggleVoiceover = document.getElementById('toggle-voiceover') as HTMLInputElement;
const voiceoverRow = document.getElementById('voiceover-row')!;
const purposeRadios = document.querySelectorAll<HTMLInputElement>('input[name="recording-purpose"]');

function getRecordingPurpose(): 'guide' | 'library' {
  const checked = document.querySelector<HTMLInputElement>('input[name="recording-purpose"]:checked');
  return checked?.value === 'library' ? 'library' : 'guide';
}

function updatePurposeUI(): void {
  const library = getRecordingPurpose() === 'library';
  voiceoverRow.classList.toggle('hidden', !library);
  if (!library) {
    toggleVoiceover.checked = false;
  }
}

function setPurposeInputsDisabled(disabled: boolean): void {
  purposeRadios.forEach((r) => {
    r.disabled = disabled;
  });
  const block = document.getElementById('recording-purpose');
  if (block) block.classList.toggle('is-disabled', disabled);
}

async function loadSources() {
  if (!window.showcaseit?.getSources) {
    statusMessage.textContent = 'Desktop API unavailable — open this app from ShowcaseIt (Electron), not in a browser tab.';
    return;
  }

  statusMessage.textContent = 'Loading sources...';
  try {
    const sources = await window.showcaseit.getSources();
    sourcesGrid.innerHTML = '';

    sources.forEach((source) => {
      const item = document.createElement('div');
      item.className = 'source-item';
      item.innerHTML = `
      <img src="${source.thumbnail}" alt="${source.name}" />
      <span>${source.name}</span>
    `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.source-item').forEach((el) => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedSourceId = source.id;
        selectedSourceName = source.name;
        statusMessage.textContent = `Selected: ${source.name}`;
      });
      sourcesGrid.appendChild(item);
    });

    statusMessage.textContent = `Found ${sources.length} source(s) — select one to record`;
  } catch (err) {
    statusMessage.textContent = `Could not load sources: ${err}`;
  }
}

function showClickTargetRipple(clientX: number, clientY: number): void {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.className = 'si-click-ripple-host';
  host.style.left = `${clientX}px`;
  host.style.top = `${clientY}px`;
  host.innerHTML = `
    <div class="si-click-ripple-stack">
      <span class="si-click-ripple-ring"></span>
      <span class="si-click-ripple-ring si-click-ripple-ring--delayed"></span>
      <span class="si-click-ripple-core"></span>
    </div>
  `;
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 900);
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function startRecording() {
  if (!selectedSourceId) {
    if (sourcesGrid.childElementCount === 0) {
      await loadSources();
    }
    if (!selectedSourceId) {
      statusMessage.textContent = 'Select a screen or window above, then press Start Recording';
      return;
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSourceId,
        },
      } as any,
    });

    lastRecordingHadVoiceover = false;
    lastRecordingPurpose = getRecordingPurpose();
    const library = lastRecordingPurpose === 'library';
    const wantVoice = library && toggleVoiceover.checked;
    if (wantVoice) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));
        lastRecordingHadVoiceover = stream.getAudioTracks().length > 0;
      } catch {
        statusMessage.textContent = 'No microphone found — recording without audio';
        lastRecordingHadVoiceover = false;
      }
    }

    recordedChunks = [];
    lastRecordingBuffer = null;
    lastRecordingMetadata = null;
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Track clicks from renderer if enabled
    if (toggleClicks.checked) {
      document.addEventListener('mousedown', onClickCapture);
    }

    mediaRecorder.start(100);
    await window.showcaseit.startRecording(selectedSourceId, {
      trackMouse: toggleMouse.checked,
      trackClicks: toggleClicks.checked,
    });

    isRecording = true;
    setPurposeInputsDisabled(true);
    recordingStartTime = Date.now();
    btnRecord.classList.add('hidden');
    btnStop.classList.remove('hidden');
    btnUpload.classList.add('hidden');
    recordingIndicator.classList.add('active');
    statusMessage.textContent = 'Recording...';

    timerInterval = setInterval(() => {
      timerDisplay.textContent = formatTime(Date.now() - recordingStartTime);
    }, 1000);
  } catch (err) {
    statusMessage.textContent = `Error: ${err}`;
  }
}

function onClickCapture(e: MouseEvent) {
  if (!isRecording) return;
  const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
  if (e.button === 0) {
    showClickTargetRipple(e.clientX, e.clientY);
  }
  window.showcaseit.recordClick(e.screenX, e.screenY, button);
}

async function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  document.removeEventListener('mousedown', onClickCapture);
  statusMessage.textContent = 'Stopping...';

  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach((track) => track.stop());

  const result = await window.showcaseit.stopRecording();

  isRecording = false;
  setPurposeInputsDisabled(false);
  if (timerInterval) clearInterval(timerInterval);

  btnStop.classList.add('hidden');
  btnRecord.classList.remove('hidden');
  recordingIndicator.classList.remove('active');
  timerDisplay.textContent = '00:00';

  statusMessage.textContent = 'Saving recording...';

  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const arrayBuffer = await blob.arrayBuffer();

  const metadata = {
    sourceName: selectedSourceName,
    duration: result.duration,
    width: result.width,
    height: result.height,
    mouseEvents: result.mouseEvents,
    clickEvents: result.clickEvents,
    recordedAt: new Date().toISOString(),
    hasVoiceover: lastRecordingHadVoiceover,
    recordingPurpose: lastRecordingPurpose,
  };

  lastRecordingBuffer = arrayBuffer;
  lastRecordingMetadata = metadata;

  const saved = await window.showcaseit.saveRecording(arrayBuffer, metadata);
  statusMessage.textContent = `Saved! (${formatTime(result.duration)}) — ${result.mouseEvents.length} mouse, ${result.clickEvents.length} clicks`;

  btnUpload.classList.remove('hidden');
  console.log('Recording saved to:', saved.videoPath);
}

async function uploadRecording() {
  if (!lastRecordingBuffer || !lastRecordingMetadata) {
    statusMessage.textContent = 'No recording to upload';
    return;
  }

  statusMessage.textContent = 'Uploading to ShowcaseIt web...';
  btnUpload.classList.add('hidden');

  const uploadMeta = {
    ...lastRecordingMetadata,
    title: lastRecordingMetadata.sourceName || 'Desktop Recording',
    projectId: '',
    userId: '',
  };

  const result = await window.showcaseit.uploadToWeb(lastRecordingBuffer, uploadMeta);

  if (result.success) {
    statusMessage.textContent = 'Uploaded successfully! Check your web dashboard.';
    lastRecordingBuffer = null;
    lastRecordingMetadata = null;
  } else {
    statusMessage.textContent = 'Upload failed — recording saved locally';
    btnUpload.classList.remove('hidden');
  }
}

btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
btnUpload.addEventListener('click', uploadRecording);

const refreshBtn = document.getElementById('btn-refresh');
if (refreshBtn) {
  refreshBtn.addEventListener('click', loadSources);
}

const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
if (btnMinimize) {
  btnMinimize.addEventListener('click', () => window.showcaseit.minimizeWindow());
}
if (btnClose) {
  btnClose.addEventListener('click', () => window.showcaseit.closeWindow());
}

purposeRadios.forEach((r) => r.addEventListener('change', updatePurposeUI));
updatePurposeUI();

statusMessage.textContent = 'Click ↻ to load screens and windows (avoids capture prompts on startup).';
