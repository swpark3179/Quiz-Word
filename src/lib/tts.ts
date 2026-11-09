/**
 * 발음 듣기 — 브라우저 내장 음성 합성(Web Speech API). 인터넷 없이 Windows 음성으로도 동작한다.
 * 목소리 우선순위: Edge 'Natural' 음성 > Aria/Jenny/Guy > Zira/David > 아무 en-US
 */

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voicesCache: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function loadVoices() {
  if (!ttsSupported) return;
  voicesCache = window.speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  listeners.forEach((l) => l());
}
if (ttsSupported) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function getVoices(): SpeechSynthesisVoice[] {
  return voicesCache;
}

export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function voiceScore(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/en[-_]US/i.test(v.lang)) s += 10;
  if (/natural/i.test(v.name)) s += 20;
  if (/aria|jenny|guy|ava|andrew|emma|brian/i.test(v.name)) s += 8;
  if (/zira|david|mark/i.test(v.name)) s += 4;
  if (/google/i.test(v.name)) s += 6;
  if (v.localService) s += 1;
  return s;
}

export function defaultVoice(): SpeechSynthesisVoice | undefined {
  return [...voicesCache].sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

export interface SpeakOptions {
  voiceURI?: string;
  rate?: number;
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!ttsSupported || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/`/g, ''));
  const voice = (opts.voiceURI && voicesCache.find((v) => v.voiceURI === opts.voiceURI)) || defaultVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-US';
  }
  u.rate = opts.rate ?? 0.9;
  synth.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel();
}
