import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface RecordingResult {
  filePath: string;
  duration: number;
  width: number;
  height: number;
}

export class CaptureManager {
  private isRecording = false;
  private startTime = 0;
  private recordingPath = '';

  async startRecording(sourceId: string): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    const outputDir = path.join(app.getPath('userData'), 'recordings');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.recordingPath = path.join(outputDir, `recording-${Date.now()}.webm`);
    this.startTime = Date.now();
    this.isRecording = true;

    // The actual MediaRecorder runs in the renderer process via desktopCapturer
    // This class manages the file output and metadata
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    const duration = Date.now() - this.startTime;
    this.isRecording = false;

    return {
      filePath: this.recordingPath,
      duration,
      width: 1920,
      height: 1080,
    };
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
