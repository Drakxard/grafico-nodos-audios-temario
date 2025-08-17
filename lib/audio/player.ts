export class Player {
  private audio = new Audio();
  private currentUrl: string | null = null;
  private currentExtId: string | null = null;

  constructor() {
    this.audio.addEventListener('ended', () => {
      if (this.currentExtId && this.onEnded) {
        this.onEnded(this.currentExtId);
      }
    });
  }

  onEnded?: (extId: string) => void;

  async play(src: string | Blob, extId: string) {
    if (this.currentUrl) {
      this.audio.pause();
      URL.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
    if (src instanceof Blob) {
      this.currentUrl = URL.createObjectURL(src);
      this.audio.src = this.currentUrl;
    } else {
      this.audio.src = src;
    }
    this.currentExtId = extId;
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }
}
