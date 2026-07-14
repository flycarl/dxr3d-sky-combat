export class AudioSystem {
  private context: AudioContext | null = null;
  private unlocked = false;
  private propOscillator: OscillatorNode | null = null;
  private propPulse: OscillatorNode | null = null;
  private propGain: GainNode | null = null;

  constructor() {
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    await this.context.resume();
    this.unlocked = true;
  }

  startPropeller(): void {
    if (!this.context || this.context.state !== 'running' || this.propOscillator) return;
    const now = this.context.currentTime;
    this.propOscillator = this.context.createOscillator();
    this.propPulse = this.context.createOscillator();
    this.propGain = this.context.createGain();
    const pulseGain = this.context.createGain();

    this.propOscillator.type = 'sawtooth';
    this.propOscillator.frequency.setValueAtTime(82, now);
    this.propPulse.type = 'square';
    this.propPulse.frequency.setValueAtTime(26, now);
    pulseGain.gain.setValueAtTime(0.018, now);
    this.propGain.gain.setValueAtTime(0.0001, now);
    this.propGain.gain.exponentialRampToValueAtTime(0.045, now + 0.18);

    this.propOscillator.connect(this.propGain);
    this.propPulse.connect(pulseGain).connect(this.propGain);
    this.propGain.connect(this.context.destination);
    this.propOscillator.start(now);
    this.propPulse.start(now);
  }

  stopPropeller(): void {
    if (!this.context || !this.propGain) return;
    const now = this.context.currentTime;
    this.propGain.gain.cancelScheduledValues(now);
    this.propGain.gain.setValueAtTime(Math.max(this.propGain.gain.value, 0.0001), now);
    this.propGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    this.propOscillator?.stop(now + 0.14);
    this.propPulse?.stop(now + 0.14);
    this.propOscillator = null;
    this.propPulse = null;
    this.propGain = null;
  }

  updatePropeller(speedRatio: number, boosting: boolean): void {
    if (!this.context || !this.propOscillator || !this.propPulse || !this.propGain) return;
    const now = this.context.currentTime;
    const ratio = Math.max(0, Math.min(speedRatio, 1.35));
    const boostLift = boosting ? 22 : 0;
    this.propOscillator.frequency.setTargetAtTime(72 + ratio * 62 + boostLift, now, 0.08);
    this.propPulse.frequency.setTargetAtTime(20 + ratio * 20 + (boosting ? 8 : 0), now, 0.08);
    this.propGain.gain.setTargetAtTime(0.034 + ratio * 0.036 + (boosting ? 0.018 : 0), now, 0.08);
  }

  pickup(index: number): void {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(320 + index * 22, now);
    oscillator.frequency.exponentialRampToValueAtTime(680 + index * 24, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  crash(): void {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  shoot(): void {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(940, now);
    oscillator.frequency.exponentialRampToValueAtTime(260, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  finish(): void {
    if (!this.context || this.context.state !== 'running') return;
    [0, 0.08, 0.16].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const now = this.context!.currentTime + offset;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime([440, 660, 880][index], now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      oscillator.connect(gain).connect(this.context!.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.16);
    });
  }

  dispose(): void {
    this.stopPropeller();
    void this.context?.close();
    this.context = null;
  }
}
