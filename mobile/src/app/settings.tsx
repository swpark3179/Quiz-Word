/** 설정 — inset grouped 리스트 */
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { useEffect, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { dayKey } from '@shared/text';
import { useToast } from '@/components/motion';
import { Icon, Segmented, T } from '@/components/ui';
import { DATA_BUILT_AT, WORDS } from '@/data/words';
import { englishVoices, speak, type VoiceInfo } from '@/lib/tts';
import { exportProgress, useProgress } from '@/store/progress';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <T v="footnote" color="muted" style={{ paddingHorizontal: 16, textTransform: 'uppercase' }}>
        {title}
      </T>
      <View style={[styles.group, { backgroundColor: c.surface }]}>{children}</View>
      {footer && (
        <T v="footnote" color="muted" style={{ paddingHorizontal: 16, lineHeight: 18 }}>
          {footer}
        </T>
      )}
    </View>
  );
}

function Row({ label, detail, right, onPress, last, danger }: { label: string; detail?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed && onPress ? c.surface2 : 'transparent' }]}>
      <View style={[styles.rowInner, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: danger ? c.danger : c.text }]}>{label}</Text>
          {detail && <Text style={[type.footnote, { color: c.muted, marginTop: 2 }]}>{detail}</Text>}
        </View>
        {right}
        {onPress && !right && <Icon name="chevron.right" size={13} color={c.muted} />}
      </View>
    </Pressable>
  );
}

export default function Settings() {
  const { c } = useTheme();
  const settings = useProgress((s) => s.settings);
  const update = useProgress((s) => s.updateSettings);
  const importData = useProgress((s) => s.importData);
  const resetProgress = useProgress((s) => s.resetProgress);
  const cardsN = useProgress((s) => Object.keys(s.cards).length);
  const toast = useToast((s) => s.show);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void englishVoices().then(setVoices);
  }, []);

  const voiceName = voices.find((v) => v.identifier === settings.ttsVoice)?.name ?? `자동${voices[0] ? ` (${voices[0].name})` : ''}`;
  const examDate = settings.examDate ? new Date(`${settings.examDate}T00:00:00`) : null;

  const pickVoice = () => {
    const list = voices.slice(0, 12);
    ActionSheetIOS.showActionSheetWithOptions(
      { title: '목소리', message: '설정 앱 > 손쉬운 사용 > 읽기 및 말하기 에서 고품질 목소리를 내려받을 수 있어요', options: ['자동', ...list.map((v) => `${v.name}${v.enhanced ? ' (고품질)' : ''} · ${v.language}`), '취소'], cancelButtonIndex: list.length + 1 },
      (i) => {
        if (i === 0) update({ ttsVoice: undefined });
        else if (i <= list.length) {
          update({ ttsVoice: list[i - 1].identifier });
          speak('Escalate the issue to a human agent.', { voice: list[i - 1].identifier, rate: settings.ttsRate });
        }
      },
    );
  };

  const doExport = async () => {
    try {
      const file = new File(Paths.cache, `quiz-word-progress-${dayKey()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(exportProgress());
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch (e) {
      Alert.alert('내보내지 못했어요', (e as Error).message);
    }
  };

  const doImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const data = JSON.parse(await new File(res.assets[0].uri).text());
      Alert.alert('진행 기록을 가져올까요?', '지금 기기에 있는 기록은 가져온 파일의 기록으로 바뀝니다.', [
        { text: '취소', style: 'cancel' },
        {
          text: '가져오기',
          style: 'destructive',
          onPress: () => {
            try {
              importData(data);
              void haptic.success();
              toast('진행 기록을 가져왔어요');
            } catch (e) {
              Alert.alert('가져오지 못했어요', (e as Error).message);
            }
          },
        },
      ]);
    } catch {
      Alert.alert('가져오지 못했어요', 'JSON 파일이 아니거나 손상된 파일이에요.');
    }
  };

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        toast('최신 버전이에요');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('업데이트를 받았어요', '지금 다시 시작해 적용할까요?', [
        { text: '나중에', style: 'cancel' },
        { text: '다시 시작', onPress: () => void Updates.reloadAsync() },
      ]);
    } catch {
      Alert.alert('업데이트를 확인할 수 없어요', '개발 모드(Expo Go)에서는 확인할 수 없고, TestFlight 로 설치한 앱에서만 동작해요.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={{ backgroundColor: c.bg }}>
      <Group title="학습" footer="시험일을 정하면 복습 간격이 시험일을 넘지 않게 맞춰져, 시험 전에 모든 단어를 한 번 더 봅니다.">
        <Row
          label="시험일"
          right={
            examDate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <DateTimePicker value={examDate} mode="date" display="compact" minimumDate={new Date()} locale="ko-KR" onChange={(_, d) => d && update({ examDate: dayKey(d) })} />
                <Pressable hitSlop={8} onPress={() => update({ examDate: undefined })}>
                  <Icon name="xmark.circle.fill" size={18} color={c.muted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => update({ examDate: dayKey(new Date(Date.now() + 14 * 86_400_000)) })}>
                <T v="body" color="primary">
                  정하기
                </T>
              </Pressable>
            )
          }
        />
        <Row
          label="하루 새 단어"
          right={
            <Stepper
              value={settings.newPerDay}
              options={[10, 20, 30, 50, 80, 120, 200]}
              onChange={(v) => update({ newPerDay: v })}
            />
          }
        />
        <Row label="틀린 단어 자동으로 오답노트에" detail="객관식 오답, 플래시카드 '모른다'" right={<Switch value={settings.wrongAutoAdd} onValueChange={(v) => update({ wrongAutoAdd: v })} trackColor={{ true: c.primary }} />} />
        <Row label="오답노트에서 빠지는 기준" right={<Stepper value={settings.wrongGraduate} options={[1, 2, 3, 4, 5]} suffix="번 연속" onChange={(v) => update({ wrongGraduate: v })} />} last />
      </Group>

      <Group title="발음">
        <Row label="목소리" detail={voiceName} onPress={pickVoice} />
        <View style={[styles.rowInner, { marginLeft: 16, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator, flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingVertical: 12 }]}>
          <Text style={[type.body, { color: c.text }]}>말하기 속도</Text>
          <Segmented
            value={String(settings.ttsRate)}
            onChange={(v) => {
              update({ ttsRate: Number(v) });
              speak('deterministic', { voice: settings.ttsVoice, rate: Number(v) });
            }}
            options={[0.7, 0.8, 0.9, 1, 1.1].map((r) => ({ value: String(r), label: `${r}배` }))}
          />
        </View>
        <Row label="카드가 나올 때 자동 발음" right={<Switch value={settings.autoSpeak} onValueChange={(v) => update({ autoSpeak: v })} trackColor={{ true: c.primary }} />} last />
      </Group>

      <Group title="화면">
        <View style={{ padding: 12 }}>
          <Segmented
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: '시스템' },
              { value: 'light', label: '밝게' },
              { value: 'dark', label: '어둡게' },
            ]}
          />
        </View>
      </Group>

      <Group title="진행 기록" footer={`학습한 단어 ${cardsN}개 / 전체 ${WORDS.length.toLocaleString()}개. 웹 버전에서 내보낸 파일도 그대로 가져올 수 있어요.`}>
        <Row label="내보내기" detail="JSON 파일로 저장·공유" onPress={doExport} />
        <Row label="가져오기" detail="웹 또는 다른 기기에서 내보낸 파일" onPress={doImport} />
        <Row
          label="기록 초기화"
          danger
          last
          onPress={() =>
            Alert.alert('학습 기록을 모두 지울까요?', '복습 일정·오답노트·통계가 지워집니다. 설정은 유지됩니다.', [
              { text: '취소', style: 'cancel' },
              {
                text: '지우기',
                style: 'destructive',
                onPress: () => {
                  resetProgress();
                  toast('학습 기록을 초기화했어요');
                },
              },
            ])
          }
        />
      </Group>

      <Group title="정보">
        <Row label="단어 데이터" detail={`${WORDS.length.toLocaleString()}개 · ${DATA_BUILT_AT.slice(0, 10)} 기준`} />
        <Row label="앱 버전" detail={`${Constants.expoConfig?.version ?? ''} (${Updates.updateId ? `업데이트 ${Updates.updateId.slice(0, 8)}` : '내장 번들'})`} />
        <Row label={checking ? '확인하는 중…' : '업데이트 확인'} onPress={checking ? undefined : checkUpdate} last />
      </Group>
    </ScrollView>
  );
}

function Stepper({ value, options, onChange, suffix = '개' }: { value: number; options: number[]; onChange: (v: number) => void; suffix?: string }) {
  const { c } = useTheme();
  const i = Math.max(0, options.indexOf(value));
  const step = (d: number) => {
    const next = options[Math.max(0, Math.min(options.length - 1, i + d))];
    if (next !== value) {
      void haptic.select();
      onChange(next);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={[type.body, { color: c.text2, fontVariant: ['tabular-nums'] }]}>
        {value}
        {suffix}
      </Text>
      <View style={[styles.stepper, { backgroundColor: c.surface2 }]}>
        <Pressable onPress={() => step(-1)} hitSlop={6} style={styles.stepBtn}>
          <Icon name="minus" size={13} color={i > 0 ? c.text : c.separator} />
        </Pressable>
        <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: c.separator }} />
        <Pressable onPress={() => step(1)} hitSlop={6} style={styles.stepBtn}>
          <Icon name="plus" size={13} color={i < options.length - 1 ? c.text : c.separator} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60, gap: 26 },
  group: { borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' },
  row: { paddingLeft: 16 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 16, minHeight: 50 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 9 },
  stepBtn: { width: 40, height: 32, alignItems: 'center', justifyContent: 'center' },
});
