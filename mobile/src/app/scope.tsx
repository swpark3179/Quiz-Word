/** 범위 고르기 시트 (formSheet) — 웹 ScopePicker 와 같은 항목 */
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEVELS } from '@shared/schema';
import { filterScope, type Scope } from '@shared/scope';
import { Button, Chip, T } from '@/components/ui';
import { EXAMS, examName, quizSources, sourceName, WORDS } from '@/data/words';
import { useProgress } from '@/store/progress';
import { levelLabel, MODE_INFO, scopeOf, sessionHref, startFromSheet, useScopes, type StudyMode } from '@/store/session';
import { useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 9 }}>
      <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

export default function ScopeSheet() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = (params.mode && params.mode in MODE_INFO ? params.mode : 'flash') as StudyMode;
  const stored = useScopes((s) => s.scopes);
  const setStored = useScopes((s) => s.setScope);
  const [scope, setScope] = useState<Scope>(() => scopeOf(mode, stored));
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const matched = useMemo(() => filterScope(WORDS, scope, { cards, wrong }).length, [scope, cards, wrong]);
  const willStudy = scope.count > 0 ? Math.min(scope.count, matched) : matched;

  const set = (patch: Partial<Scope>) => setScope((s) => ({ ...s, ...patch }));
  const files = scope.set === 'exam' ? quizSources(scope.cat) : [];
  /** 문제 파일은 고른 시험 안에서 고른다 */
  const pickFile = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `${examName(scope.cat)} 문제 파일`, options: [`${examName(scope.cat)} 전체`, ...files.map((s) => s.name), '취소'], cancelButtonIndex: files.length + 1 },
      (i) => {
        if (i > files.length) return;
        void haptic.select();
        set({ file: i === 0 ? undefined : files[i - 1].id });
      },
    );
  const pickLevel = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: '단계',
        options: [...LEVELS.map((l) => (l.level === 1 ? '모든 단계 (쉬운 단어 포함)' : `${levelLabel(l.level)} (${l.name}${l.level < LEVELS.length ? '~' : ''})`)), '취소'],
        cancelButtonIndex: LEVELS.length,
      },
      (i) => {
        if (i >= LEVELS.length) return;
        void haptic.select();
        set({ minLevel: LEVELS[i].level });
      },
    );

  const start = () => {
    setStored(mode, scope);
    startFromSheet(sessionHref(mode, scope));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}>
        <View style={{ gap: 4 }}>
          <T v="title2">{MODE_INFO[mode].title}</T>
          <T v="subhead" color="text2">
            {MODE_INFO[mode].desc}
          </T>
        </View>
        <Row label="시험">
          {EXAMS.map((e) => (
            <Chip key={e.id} label={e.name} active={scope.set === 'exam' && scope.cat === e.id} onPress={() => set({ set: 'exam', cat: e.id, file: undefined })} />
          ))}
          <Chip label="모든 단어 (확장 포함)" active={scope.set === 'all'} onPress={() => set({ set: 'all', cat: undefined, file: undefined })} />
          <Chip label="오답노트" active={scope.set === 'wrong'} onPress={() => set({ set: 'wrong', cat: undefined, file: undefined })} />
        </Row>
        {scope.set === 'exam' && files.length > 0 && (
          <Row label="문제 파일">
            <Chip label={scope.cat && scope.file ? sourceName(scope.cat, scope.file) : `${examName(scope.cat)} 전체 ▾`} active={!!scope.file} onPress={pickFile} />
          </Row>
        )}
        {scope.set !== 'wrong' && (
          <Row label="단계">
            <Chip label={`${levelLabel(scope.minLevel)} ▾`} active={scope.minLevel > 1} onPress={pickLevel} />
          </Row>
        )}
        <Row label="학습 상태">
          {(
            [
              ['unmastered', '아직 못 익힌 단어'],
              ['new', '새 단어'],
              ['learning', '학습 중'],
              ['any', '전체'],
            ] as const
          ).map(([v, l]) => (
            <Chip key={v} label={l} active={scope.status === v} onPress={() => set({ status: v })} />
          ))}
        </Row>
        <Row label="개수">
          {[20, 50, 100, 0].map((n) => (
            <Chip key={n} label={n ? `${n}개` : '전부'} active={scope.count === n} onPress={() => set({ count: n })} />
          ))}
        </Row>
        <Row label="순서">
          {(
            [
              ['freq', '자주 나온 순'],
              ['random', '무작위'],
              ['new-first', '새 단어 먼저'],
            ] as const
          ).map(([v, l]) => (
            <Chip key={v} label={l} active={scope.order === v} onPress={() => set({ order: v })} />
          ))}
        </Row>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom), backgroundColor: c.bg, borderTopColor: c.separator }]}>
        <T v="footnote" color="text2" style={{ textAlign: 'center' }}>
          조건에 맞는 단어 <T v="footnote" style={{ fontWeight: '700' }}>{matched.toLocaleString()}</T>개
          {willStudy !== matched ? ` 중 ${willStudy}개를 학습해요` : ''}
        </T>
        <Button title={willStudy ? `${willStudy}개 시작하기` : '학습할 단어가 없어요'} icon="play.fill" variant="primary" big disabled={!willStudy} onPress={start} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 26, gap: 22 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
