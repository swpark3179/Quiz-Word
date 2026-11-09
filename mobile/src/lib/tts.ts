/**
 * 발음 듣기 — iOS 내장 음성(AVSpeechSynthesizer). 인터넷 없이 동작한다.
 * 무음 스위치를 켜 둬도 들리도록 앱 시작 때 오디오 세션을 재생 모드로 바꾼다(prepareAudio).
 */
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { create } from 'zustand';

/** 지금 말하고 있는 텍스트 키 — 🔊 버튼의 파형 애니메이션용 */
export const useSpeaking = create<{ key: string | null }>(() => ({ key: null }));

export async function prepareAudio() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // 오디오 세션을 못 바꿔도 발음은 무음 모드가 아닐 때 들린다
  }
}

export interface SpeakOptions {
  voice?: string;
  rate?: number;
}

export function speak(text: string, opts: SpeakOptions = {}, key: string = text) {
  if (!text) return;
  void Speech.stop();
  useSpeaking.setState({ key });
  const clear = () => {
    if (useSpeaking.getState().key === key) useSpeaking.setState({ key: null });
  };
  Speech.speak(text.replace(/`/g, ''), {
    language: 'en-US',
    voice: opts.voice,
    rate: opts.rate ?? 0.9,
    useApplicationAudioSession: true,
    onDone: clear,
    onStopped: clear,
    onError: clear,
  });
}

export function stopSpeaking() {
  void Speech.stop();
  useSpeaking.setState({ key: null });
}

export interface VoiceInfo {
  identifier: string;
  name: string;
  language: string;
  enhanced: boolean;
}

/** 영어 목소리 — 고품질(Enhanced)·미국 영어를 앞으로 */
export async function englishVoices(): Promise<VoiceInfo[]> {
  try {
    const all = await Speech.getAvailableVoicesAsync();
    return all
      .filter((v) => /^en[-_]/i.test(v.language))
      .map((v) => ({ identifier: v.identifier, name: v.name, language: v.language, enhanced: String(v.quality) === 'Enhanced' }))
      .sort(
        (a, b) =>
          Number(b.enhanced) - Number(a.enhanced) ||
          Number(/en[-_]US/i.test(b.language)) - Number(/en[-_]US/i.test(a.language)) ||
          a.name.localeCompare(b.name),
      );
  } catch {
    return [];
  }
}
