export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private startTime = 0;

  async start() {
    if (this.mediaRecorder) throw new Error('busy');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : undefined;
    this.mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    this.chunks = [];
    this.startTime = Date.now();
    this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
    this.mediaRecorder.start();
    return this.mediaRecorder.mimeType;
  }

  stop(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('not-recording'));
        return;
      }
      const mr = this.mediaRecorder;
      mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: mr.mimeType });
        const duration = (Date.now() - this.startTime) / 1000;
        this.mediaRecorder = null;
        resolve({ blob, duration });
      };
      mr.stop();
    });
  }
}
