type SpeakOptions = {
  onEnd?: () => void;
  onError?: () => void;
  onStart?: () => void;
};

class TTSService {
  private synth: SpeechSynthesis | null =
    typeof window !== "undefined" ? window.speechSynthesis : null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private finishCurrent: (() => void) | null = null;

  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string, options?: SpeakOptions) {
    if (!this.isSupported() || !text.trim()) {
      options?.onError?.();
      return false;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.currentUtterance = null;
      this.finishCurrent = null;
      options?.onEnd?.();
    };

    this.finishCurrent = finish;
    this.currentUtterance = utterance;

    utterance.onend = finish;
    utterance.onerror = () => {
      finish();
      options?.onError?.();
    };

    this.synth?.speak(utterance);
    options?.onStart?.();
    return true;
  }

  stop() {
    if (!this.synth) return;

    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
    }

    this.finishCurrent?.();
  }
}

export const ttsService = new TTSService();
