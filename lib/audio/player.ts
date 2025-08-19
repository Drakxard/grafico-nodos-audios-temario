export class Player {
  private audio: HTMLAudioElement;
  private currentExtId: string | null = null;

  constructor() {
    this.audio = new Audio();
  }

  async play(extId: string, src: Blob): Promise<void> {
    if (this.audio.src) URL.revokeObjectURL(this.audio.src);
    this.audio.src = URL.createObjectURL(src);
    this.currentExtId = extId;
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  onEnded(cb: () => void) {
    this.audio.onended = cb;
  }

  get playingExtId() {
    return this.currentExtId;
  }
}
