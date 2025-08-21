export class Recorder {
  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private mime = 'audio/webm;codecs=opus';

  async start(): Promise<void> {
    if (this.mediaRecorder?.state === 'recording') {
      throw new Error('E_BUSY');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.mime });
    this.chunks = [];
    this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob> {
    if (!this.mediaRecorder) {
      throw new Error('E_BUSY');
    }
      const recorder = this.mediaRecorder;
      return new Promise(resolve => {
        recorder!.addEventListener('stop', () => {
          const blob = new Blob(this.chunks, { type: this.mime });
          recorder!.stream.getTracks().forEach(t => t.stop());
          this.mediaRecorder = undefined;
          resolve(blob);
        });
        recorder!.stop();
      });
  }
}
