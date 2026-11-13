/** 설정 — inset grouped 리스트 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { mergeExamPack, type ExamPackFile } from '@shared/exampack';
import { inExam } from '@shared/exams';
import { dayKey } from '@shared/text';
import { diffWordSets, type WordSetFile } from '@shared/wordset';
import { useToast } from '@/components/motion';
import { Icon, Segmented, T } from '@/components/ui';
import { ACTIVE_RAW, EXAMS, examName, mainExam, quizSources, WORD_SET_INFO, WORDS } from '@/data/words';
import { EXAM_PACK_GUIDE_URL, EXAM_PACK_SITE_URL, installExamPack, readExamPackFile, removeExamPack } from '@/lib/examPacks';
import { showActionSheet } from '@/lib/sheet';
import { englishVoices, speak, type VoiceInfo } from '@/lib/tts';
import { canImportWordSet, installWordSet, readWordSetFile, removeImportedWordSet, restartApp, type InstalledPack } from '@/lib/wordSet';
import { exportProgress, useProgress } from '@/store/progress';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

const ANDROID = Platform.OS === 'android';
/** 이 기기를 부르는 말 */
const DEVICE = ANDROID ? '휴대폰' : 'iPhone';
/** JSON 파일 고르기 — iOS 는 UTI 도 받고, 안드로이드는 MIME 타입만 받는다 */
const JSON_TYPES = ANDROID ? ['application/json', '*/*'] : ['application/json', 'public.json', '*/*'];

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
  const notebooksN = useProgress((s) => s.notebooks.length);
  const toast = useToast((s) => s.show);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);

  useEffect(() => {
    void englishVoices().then(setVoices);
  }, []);

  const voiceName = voices.find((v) => v.identifier === settings.ttsVoice)?.name ?? `자동${voices[0] ? ` (${voices[0].name})` : ''}`;
  const examDate = settings.examDate ? new Date(`${settings.examDate}T00:00:00`) : null;

  const pickVoice = () => {
    const list = voices.slice(0, 12);
    showActionSheet(
      { title: '목소리', message: ANDROID ? '휴대폰 설정의 텍스트 음성 변환(TTS)에서 영어 음성 데이터를 내려받을 수 있어요' : '설정 앱 > 손쉬운 사용 > 읽기 및 말하기 에서 고품질 목소리를 내려받을 수 있어요', options: ['자동', ...list.map((v) => `${v.name}${v.enhanced ? ' (고품질)' : ''} · ${v.language}`), '취소'], cancelButtonIndex: list.length + 1 },
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
    const res = await DocumentPicker.getDocumentAsync({ type: JSON_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const data = JSON.parse(await new File(res.assets[0].uri).text());
      const fileNotebooks = Array.isArray(data?.notebooks) ? data.notebooks.length : 0;
      Alert.alert('진행 기록을 가져올까요?', `지금 기기에 있는 기록과 학습장(${notebooksN}개)은 가져온 파일의 기록과 학습장(${fileNotebooks}개)으로 바뀝니다.`, [
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

  /* ───── 단어 세트: 파일에서 불러오기 · 앱 기본으로 되돌리기 ───── */
  const restartOrTell = async (savedMessage: string) => {
    if (!(await restartApp())) Alert.alert(savedMessage, '앱을 완전히 닫았다가 다시 열면 적용돼요.');
  };

  const applyWordSet = async (set: WordSetFile) => {
    try {
      installWordSet(set);
    } catch (e) {
      Alert.alert('단어 세트를 저장하지 못했어요', (e as Error).message);
      return;
    }
    void haptic.success();
    await restartOrTell('단어 세트를 저장했어요');
  };

  const doImportWordSet = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: JSON_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    let set: WordSetFile;
    try {
      set = await readWordSetFile(res.assets[0].uri);
    } catch (e) {
      Alert.alert('불러오지 못했어요', (e as Error).message);
      return;
    }
    const { added, removed } = diffWordSets(
      WORDS.map((w) => w.id),
      set.words.map((w) => w.id ?? ''),
    );
    const cards = useProgress.getState().cards;
    const studiedGone = removed.filter((id) => cards[id]).length;
    Alert.alert(
      '단어 세트를 바꿀까요?',
      [
        `${WORDS.length.toLocaleString()}개 → ${set.count.toLocaleString()}개 (추가 ${added.length} · 빠짐 ${removed.length})`,
        `${formatDate(set.builtAt)} 에 만든 파일`,
        studiedGone ? `빠지는 단어 중 ${studiedGone}개는 학습 기록이 있어요. 기록은 지워지지 않고, 그 단어가 다시 들어오면 이어져요.` : '',
        '진행 기록·학습장은 그대로예요. 바꾸면 앱이 다시 시작돼요.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      [
        { text: '취소', style: 'cancel' },
        { text: '바꾸고 다시 시작', onPress: () => void applyWordSet(set) },
      ],
    );
  };

  const revertWordSet = () =>
    Alert.alert('앱 기본 단어 세트로 되돌릴까요?', `앱에 들어 있는 단어(${formatDate(WORD_SET_INFO.bundledBuiltAt)})로 바뀌어요. 진행 기록·학습장은 그대로예요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '되돌리고 다시 시작',
        style: 'destructive',
        onPress: () => {
          try {
            removeImportedWordSet();
          } catch (e) {
            Alert.alert('되돌리지 못했어요', (e as Error).message);
            return;
          }
          void restartOrTell('앱 기본 단어 세트로 되돌렸어요');
        },
      },
    ]);

  /* ───── 시험: 시험 팩으로 시험 하나를 얹기 · 얹은 시험 지우기 ───── */
  const examRows = useMemo(
    () =>
      EXAMS.map((e) => ({
        id: e.id,
        name: e.name,
        files: quizSources(e.id).length,
        words: WORDS.filter((w) => inExam(w, e.id)).length,
        pack: WORD_SET_INFO.packs.find((p) => p.id === e.id),
      })),
    [],
  );

  const applyExamPack = async (pack: ExamPackFile) => {
    try {
      installExamPack(pack);
    } catch (e) {
      Alert.alert('시험 팩을 저장하지 못했어요', (e as Error).message);
      return;
    }
    void haptic.success();
    await restartOrTell('시험을 추가했어요');
  };

  const doImportExamPack = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: JSON_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    let pack: ExamPackFile;
    try {
      pack = await readExamPackFile(res.assets[0].uri);
    } catch (e) {
      Alert.alert('불러오지 못했어요', (e as Error).message);
      return;
    }
    // 지금 단어 위에 얹으면 무엇이 바뀌는지 미리 따져 본다
    const { report } = mergeExamPack(ACTIVE_RAW, pack);
    const sensed = new Set(report.addedSenses.map((s) => s.id)).size;
    Alert.alert(
      report.replacedExam ? `'${report.examName}' 시험을 바꿀까요?` : `'${report.examName}' 시험을 추가할까요?`,
      [
        `문제 파일 ${report.sources}개 · 예문 ${report.examples.toLocaleString()}개 · ${formatDate(pack.builtAt)} 에 만든 파일`,
        `새 단어 ${report.addedWords.length.toLocaleString()}개를 넣고, 이미 있는 단어 ${report.keptWords.length.toLocaleString()}개는 그대로 둬요${sensed ? ` (그중 ${sensed}개에 이 시험에서 쓰는 뜻을 덧붙여요)` : ''}.`,
        report.replacedExam ? '같은 이름표(id)의 시험이 이미 있어서 그 시험의 예문·횟수가 이 파일의 것으로 바뀌어요.' : '',
        '다른 시험·진행 기록·학습장은 그대로예요. 추가하면 앱이 다시 시작돼요.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      [
        { text: '취소', style: 'cancel' },
        { text: report.replacedExam ? '바꾸고 다시 시작' : '추가하고 다시 시작', onPress: () => void applyExamPack(pack) },
      ],
    );
  };

  const removePack = (pack: InstalledPack) =>
    Alert.alert(
      `'${pack.name}' 시험을 지울까요?`,
      [
        pack.replaced ? '이 시험 팩을 지우면 앱 기본 단어에 있던 같은 시험으로 돌아가요.' : '이 시험과, 이 시험에만 있던 단어가 빠져요.',
        '그 단어의 진행 기록은 지워지지 않고, 같은 시험 팩을 다시 불러오면 이어져요. 지우면 앱이 다시 시작돼요.',
      ].join('\n\n'),
      [
        { text: '취소', style: 'cancel' },
        {
          text: '지우고 다시 시작',
          style: 'destructive',
          onPress: () => {
            try {
              removeExamPack(pack.id);
            } catch (e) {
              Alert.alert('지우지 못했어요', (e as Error).message);
              return;
            }
            void restartOrTell('시험을 지웠어요');
          },
        },
      ],
    );

  /* ───── 시험 팩 만드는 법: 안내 페이지 열기 · 가이드 주소 보내기 ───── */
  const openExamPackSite = async () => {
    try {
      await Linking.openURL(EXAM_PACK_SITE_URL);
    } catch {
      Alert.alert('페이지를 열지 못했어요', EXAM_PACK_SITE_URL);
    }
  };

  const shareExamPackGuide = async () => {
    try {
      // iOS 는 url 을 주면 링크로 공유되고(복사·AirDrop·메시지), 안드로이드는 message 만 보낸다
      await Share.share(ANDROID ? { message: EXAM_PACK_GUIDE_URL } : { url: EXAM_PACK_GUIDE_URL });
    } catch (e) {
      Alert.alert('보내지 못했어요', (e as Error).message);
    }
  };

  const examFooter = [
    WORD_SET_INFO.packErrors.length ? `읽지 못해 건너뛴 시험 팩이 있어요 (${WORD_SET_INFO.packErrors.join(' / ')}). 그 시험 팩을 다시 불러오세요.` : '',
    '시험 팩(*.exampack.json)은 시험 하나를 지금 단어 위에 더하는 파일이에요. 이미 있는 단어의 뜻·단계·외우기는 바뀌지 않아요. 추가한 시험은 눌러서 지울 수 있어요.',
    '시험 팩은 문제 파일과 가이드 주소를 코딩 에이전트에게 주면 만들 수 있어요. "시험 팩 만드는 법"에 지시문 예시와 검사기가 있어요.',
  ]
    .filter(Boolean)
    .join('\n');

  const imported = WORD_SET_INFO.origin === 'imported';
  const bundledNewer = imported && WORD_SET_INFO.bundledBuiltAt > WORD_SET_INFO.builtAt;
  const wordSetFooter = [
    WORD_SET_INFO.error ? `불러온 단어 세트를 읽지 못해 앱 기본 단어로 열었어요 (${WORD_SET_INFO.error}). 파일을 다시 불러오세요.` : '',
    bundledNewer ? `앱 기본 단어(${formatDate(WORD_SET_INFO.bundledBuiltAt)})가 불러온 파일보다 최근이에요. 되돌리면 앱 기본 단어를 써요.` : '',
    `웹 설정의 "단어 세트 파일 내려받기"로 만든 파일을 ${ANDROID ? 'Google Drive·메신저·USB' : 'AirDrop·iCloud Drive'} 등으로 ${DEVICE} 에 옮긴 뒤 불러오세요. 진행 기록은 단어 id 기준이라 그대로 이어집니다. 단어 세트를 바꾸거나 되돌려도 시험 팩으로 추가한 시험은 남아요.`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={{ backgroundColor: c.bg }}>
      <Group title="학습" footer="시험일을 정하면 복습 간격이 시험일을 넘지 않게 맞춰져, 시험 전에 모든 단어를 한 번 더 봅니다. 오늘 탭의 진척과 오늘의 새 단어는 주 시험에 나온 단어 가운데 학습 단계 이상만 셉니다 (플래시카드·객관식은 시작할 때 따로 골라요).">
        {EXAMS.length > 0 && (
          <Row
            label="주 시험"
            detail={EXAMS.length > 1 ? undefined : examName(mainExam(settings.exam))}
            right={
              EXAMS.length > 1 ? (
                <Pressable
                  onPress={() =>
                    showActionSheet({ title: '주 시험', options: [...EXAMS.map((e) => e.name), '취소'], cancelButtonIndex: EXAMS.length }, (i) => {
                      if (i < EXAMS.length) update({ exam: EXAMS[i].id });
                    })
                  }
                >
                  <T v="body" color="primary">
                    {examName(mainExam(settings.exam))}
                  </T>
                </Pressable>
              ) : undefined
            }
          />
        )}
        <Row label="학습 단계" detail="이보다 쉬운 단어는 뺀다" right={<Stepper value={settings.minLevel} options={[1, 2, 3, 4, 5, 6]} suffix="단계 이상" onChange={(v) => update({ minLevel: v })} />} />
        <Row
          label="시험일"
          right={
            examDate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {ANDROID ? (
                  // 안드로이드에는 줄 안에 넣는 날짜 선택이 없다 — 날짜를 누르면 달력 대화상자를 띄운다
                  <Pressable hitSlop={8} onPress={() => DateTimePickerAndroid.open({ value: examDate, mode: 'date', minimumDate: new Date(), onChange: (e, d) => e.type === 'set' && d && update({ examDate: dayKey(d) }) })}>
                    <T v="body" color="primary">
                      {`${examDate.getFullYear()}. ${examDate.getMonth() + 1}. ${examDate.getDate()}.`}
                    </T>
                  </Pressable>
                ) : (
                  <DateTimePicker value={examDate} mode="date" display="compact" minimumDate={new Date()} locale="ko-KR" onChange={(_, d) => d && update({ examDate: dayKey(d) })} />
                )}
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

      <Group title="시험" footer={examFooter}>
        {examRows.map((e) => (
          <Row
            key={e.id}
            label={e.name}
            detail={`문제 파일 ${e.files}개 · 단어 ${e.words.toLocaleString()}개${e.pack ? ` · 추가한 시험 (${formatDate(e.pack.builtAt)})` : ''}`}
            onPress={e.pack ? () => removePack(e.pack!) : undefined}
          />
        ))}
        {canImportWordSet && <Row label="시험 팩 불러오기" detail="시험 하나를 지금 단어 위에 더해요" onPress={doImportExamPack} />}
        <Row label="시험 팩 만드는 법" detail="안내 페이지 열기 — 지시문 예시 · 파일 검사" onPress={openExamPackSite} />
        <Row label="가이드 주소 보내기" detail="PC 나 코딩 에이전트에게 줄 주소를 복사·공유" onPress={shareExamPackGuide} last />
      </Group>

      <Group title="단어 세트" footer={wordSetFooter}>
        <Row label="지금 쓰는 단어" detail={`${imported ? '불러온 파일' : '앱 기본'} · ${formatDate(WORD_SET_INFO.builtAt)} · ${WORD_SET_INFO.count.toLocaleString()}개`} />
        <Row
          label="파일에서 불러오기"
          detail={canImportWordSet ? '웹에서 내려받은 단어 세트 파일 (.json)' : '휴대폰 앱에서만 할 수 있어요'}
          onPress={canImportWordSet ? doImportWordSet : undefined}
          last={!imported}
        />
        {imported && <Row label="앱 기본 단어 세트로 되돌리기" danger onPress={revertWordSet} last />}
      </Group>

      <Group title="진행 기록" footer={`학습한 단어 ${cardsN}개 / 전체 ${WORDS.length.toLocaleString()}개 · 학습장 ${notebooksN}개. 내보내기 파일에 학습장 전체 목록도 들어가고, 웹 버전에서 내보낸 파일도 그대로 가져올 수 있어요.`}>
        <Row label="내보내기" detail="JSON 파일로 저장·공유" onPress={doExport} />
        <Row label="가져오기" detail="웹 또는 다른 기기에서 내보낸 파일" onPress={doImport} />
        <Row
          label="기록 초기화"
          danger
          last
          onPress={() =>
            Alert.alert('학습 기록을 모두 지울까요?', '복습 일정·오답노트·통계가 지워집니다. 학습장과 설정은 유지됩니다.', [
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
        <Row label="앱 버전" detail={appVersion()} last />
      </Group>
    </ScrollView>
  );
}

/** "1.0.1 (빌드 12)" — 버전은 두 플랫폼 공통(app-version.json), 빌드는 안드로이드 versionCode · iOS buildNumber */
function appVersion(): string {
  const cfg = Constants.expoConfig;
  const version = cfg?.version ?? '';
  const build = ANDROID ? cfg?.android?.versionCode : cfg?.ios?.buildNumber;
  return `${version}${build ? ` (빌드 ${build})` : ''}`;
}

/** "2026. 11. 10. 21:30" */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '날짜 모름';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${p(d.getHours())}:${p(d.getMinutes())}`;
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
