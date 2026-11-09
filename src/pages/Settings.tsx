/** 설정 */
import { Download, Monitor, Moon, RotateCcw, Sun, Upload, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, PageHeader, SectionTitle } from '../components/ui';
import { WORDS } from '../data/words';
import { defaultVoice, getVoices, onVoicesChanged, speak, ttsSupported } from '../lib/tts';
import { dayKey } from '../lib/text';
import { exportProgress, useProgress } from '../store/progress';

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[14.5px] font-semibold">{label}</div>
        {desc && <div className="mt-0.5 text-[12.5px] text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-surface-3'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const inputCls = 'rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary';

export function SettingsPage() {
  const settings = useProgress((s) => s.settings);
  const update = useProgress((s) => s.updateSettings);
  const importData = useProgress((s) => s.importData);
  const resetProgress = useProgress((s) => s.resetProgress);
  const cardsN = useProgress((s) => Object.keys(s.cards).length);
  const [voices, setVoices] = useState(getVoices());
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onVoicesChanged(() => setVoices(getVoices())), []);

  const doExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quiz-word-progress-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('진행 기록을 파일로 저장했어요.');
  };

  const doImport = async (file: File) => {
    try {
      importData(JSON.parse(await file.text()));
      setMessage('진행 기록을 불러왔어요.');
    } catch (e) {
      setMessage(`불러오지 못했어요: ${(e as Error).message}`);
    }
  };

  return (
    <div className="anim-fade space-y-5">
      <PageHeader title="설정" />

      <Card className="divide-y divide-line px-6 sm:px-8">
        <div className="pb-1 pt-6">
          <SectionTitle>학습</SectionTitle>
        </div>
        <Field label="시험일" desc="정하면 복습 간격이 시험일을 넘지 않게 맞춰집니다">
          <div className="flex items-center gap-2">
            <input type="date" value={settings.examDate ?? ''} onChange={(e) => update({ examDate: e.target.value || undefined })} className={inputCls} />
            {settings.examDate && (
              <button onClick={() => update({ examDate: undefined })} className="text-[12.5px] text-muted hover:text-ink">
                지우기
              </button>
            )}
          </div>
        </Field>
        <Field label="하루 새 단어 수" desc="복습 화면에서 매일 새로 소개할 단어 수">
          <select value={settings.newPerDay} onChange={(e) => update({ newPerDay: Number(e.target.value) })} className={inputCls}>
            {[10, 20, 30, 50, 80, 120, 200].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </Field>
        <Field label="틀린 단어 자동으로 오답노트에 담기" desc="객관식 오답, 플래시카드 '모른다'">
          <Toggle checked={settings.wrongAutoAdd} onChange={(v) => update({ wrongAutoAdd: v })} />
        </Field>
        <Field label="오답노트에서 빠지는 기준" desc="연속으로 맞힌 횟수">
          <select value={settings.wrongGraduate} onChange={(e) => update({ wrongGraduate: Number(e.target.value) })} className={inputCls}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}번 연속
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="divide-y divide-line px-6 sm:px-8">
        <div className="pb-1 pt-6">
          <SectionTitle>발음</SectionTitle>
        </div>
        {!ttsSupported && <p className="py-4 text-sm text-danger">이 브라우저는 음성 합성을 지원하지 않습니다.</p>}
        <Field label="목소리" desc={voices.length ? `영어 목소리 ${voices.length}개` : '목소리를 불러오는 중…'}>
          <div className="flex items-center gap-2">
            <select value={settings.ttsVoice ?? ''} onChange={(e) => update({ ttsVoice: e.target.value || undefined })} className={`${inputCls} max-w-64`}>
              <option value="">자동 ({defaultVoice()?.name ?? '기본'})</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              onClick={() => speak('Escalate the issue to a human agent.', { voiceURI: settings.ttsVoice, rate: settings.ttsRate })}
              className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-primary"
              title="들어 보기"
            >
              <Volume2 size={18} />
            </button>
          </div>
        </Field>
        <Field label="말하기 속도" desc={`${settings.ttsRate.toFixed(2)}배`}>
          <input
            type="range"
            min={0.6}
            max={1.3}
            step={0.05}
            value={settings.ttsRate}
            onChange={(e) => update({ ttsRate: Number(e.target.value) })}
            className="w-48 accent-[var(--primary)]"
          />
        </Field>
        <Field label="카드가 나올 때 자동 발음">
          <Toggle checked={settings.autoSpeak} onChange={(v) => update({ autoSpeak: v })} />
        </Field>
      </Card>

      <Card className="divide-y divide-line px-6 sm:px-8">
        <div className="pb-1 pt-6">
          <SectionTitle>화면</SectionTitle>
        </div>
        <Field label="테마">
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ['system', '시스템', Monitor],
                ['light', '밝게', Sun],
                ['dark', '어둡게', Moon],
              ] as const
            ).map(([v, l, Icon]) => (
              <button
                key={v}
                onClick={() => update({ theme: v })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                  settings.theme === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon size={14} /> {l}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card className="px-6 py-6 sm:px-8">
        <SectionTitle>진행 기록</SectionTitle>
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          진행 기록은 이 브라우저(localhost:5179)에 저장됩니다. 다른 브라우저로 옮기거나 백업하려면 파일로 내보내세요. 지금까지 학습한 단어{' '}
          <b className="text-ink">{cardsN}</b>개 / 전체 {WORDS.length.toLocaleString()}개.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport}>
            <Download size={16} /> 내보내기
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> 가져오기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() => {
              if (confirm('학습 기록(복습 일정·오답노트·통계)을 모두 지울까요? 설정은 유지됩니다.')) {
                resetProgress();
                setMessage('학습 기록을 초기화했어요.');
              }
            }}
          >
            <RotateCcw size={16} /> 기록 초기화
          </Button>
        </div>
        {message && <p className="anim-fade mt-3 text-[13px] font-medium text-primary">{message}</p>}
      </Card>
    </div>
  );
}
