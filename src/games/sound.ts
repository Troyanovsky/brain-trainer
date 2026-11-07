let context: AudioContext | null = null;
export function playTone(success: boolean) {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(success ? 620 : 230, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      success ? 900 : 170,
      context.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    /* Sound is optional when Web Audio is unavailable. */
  }
}
