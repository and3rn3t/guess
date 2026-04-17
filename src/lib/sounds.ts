/**
 * Lightweight sound engine using Web Audio API synthesis.
 * No audio files needed — generates short tones programmatically.
 */

let audioCtx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (muted) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      return null
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

// ========== PUBLIC API ==========

/** Soft click when answering a question */
export function playAnswer() {
  playTone(880, 0.08, 'sine', 0.1)
}

/** Rising chime when AI is thinking */
export function playThinking() {
  const ctx = getCtx()
  if (!ctx) return
  playTone(440, 0.15, 'sine', 0.06)
  setTimeout(() => playTone(550, 0.15, 'sine', 0.06), 100)
}

/** Triumphant ascending arpeggio for correct guess */
export function playCorrectGuess() {
  const notes = [523, 659, 784, 1047] // C5-E5-G5-C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.25, 'sine', 0.12), i * 120)
  })
}

/** Descending tone for incorrect guess */
export function playIncorrectGuess() {
  playTone(400, 0.2, 'triangle', 0.1)
  setTimeout(() => playTone(300, 0.3, 'triangle', 0.1), 150)
}

/** Short pop for UI navigation */
export function playNavigate() {
  playTone(660, 0.05, 'sine', 0.08)
}

/** Gentle reveal tone when guess is shown */
export function playReveal() {
  playTone(523, 0.3, 'sine', 0.1)
  setTimeout(() => playTone(659, 0.4, 'sine', 0.1), 200)
}

// ========== HAPTICS ==========

/** Trigger a short haptic vibration if supported */
export function hapticLight() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

/** Trigger a medium haptic vibration */
export function hapticMedium() {
  if ('vibrate' in navigator) {
    navigator.vibrate(25)
  }
}

/** Trigger a success haptic pattern */
export function hapticSuccess() {
  if ('vibrate' in navigator) {
    navigator.vibrate([15, 50, 15, 50, 30])
  }
}

// ========== MUTE CONTROL ==========

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  if (value && audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
}

export function toggleMute(): boolean {
  setMuted(!muted)
  return muted
}
