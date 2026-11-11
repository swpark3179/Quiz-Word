/** 단어 상세 — large title = 단어, 문제 속 뜻별 예문, 노트, 학습 기록 */
import Markdown from '@ronradtke/react-native-markdown-display';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { freqIn, isExtra } from '@shared/exams';
import { levelName, type Context } from '@shared/schema';
import { DEFAULT_SCOPE } from '@shared/scope';
import { statusOf } from '@shared/srs';
import { relativeDue } from '@shared/text';
import { ExamPrefProvider, useExamPref } from '@/components/ExamPref';
import { useToast } from '@/components/motion';
import { Button, Card, Empty, Icon, PosBadge, SectionLabel, StatusBadge, T } from '@/components/ui';
import { ContextCard, MemoryAid, SenseList, SpeakButton } from '@/components/word';
import { contextsOf, corpusExamples, EXAMS, examName, quizSources, WORD_BY_ID, WORD_BY_SURFACE } from '@/data/words';
import { useProgress } from '@/store/progress';
import { sessionHref } from '@/store/session';
import { type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

function groupBySense(contexts: Context[]) {
  const groups: { sense: string; pos: string; items: Context[] }[] = [];
  for (const ctx of contexts) {
    const g = groups.find((x) => x.sense === ctx.sense);
    if (g) g.items.push(ctx);
    else groups.push({ sense: ctx.sense, pos: ctx.pos, items: [ctx] });
  }
  return groups;
}

export default function WordDetail() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  // cat·src: 단어장에서 시험·문제 파일을 골라 들어왔으면 그쪽 예문을 먼저 보여 준다 (없으면 주 시험)
  const { id = '', cat, src } = useLocalSearchParams<{ id: string; cat?: string; src?: string }>();
  const mainPref = useExamPref();
  const pref = useMemo(() => (cat ? { cat, ...(src ? { file: src } : {}) } : mainPref), [cat, src, mainPref]);
  const w = WORD_BY_ID.get(id);
  const card = useProgress((s) => s.cards[id]);
  const inWrong = useProgress((s) => !!s.wrong[id]);
  const history = useProgress((s) => s.history[id]);
  const addWrong = useProgress((s) => s.addWrong);
  const removeWrong = useProgress((s) => s.removeWrong);
  const toast = useToast((s) => s.show);
  const [moreOpen, setMoreOpen] = useState(false);

  const contexts = useMemo(() => (w ? contextsOf(w, 4, pref) : []), [w, pref]);
  const more = useMemo(() => (w && moreOpen ? corpusExamples(w, 12, pref).filter((x) => !contexts.some((y) => y.en === x.en)) : []), [w, moreOpen, contexts, pref]);

  if (!w) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: '단어' }} />
        <Empty icon="questionmark.circle" title="단어를 찾을 수 없어요" desc={id} />
      </View>
    );
  }

  const status = statusOf(card);
  // 문장 색인에서 자동으로 찾은 예문은 뜻이 정해져 있지 않으므로 뜻별로 묶지 않는다
  const groups = contexts.some((x) => !x.auto) ? groupBySense(contexts) : [{ sense: '', pos: '', items: contexts }];
  const examFreq = freqIn(w, pref.cat);
  const freqLabel = examFreq > 0 ? `${examName(pref.cat)} 문제에 ${examFreq}회` : w.freq > 0 ? `다른 시험 문제에 ${w.freq}회` : '';
  /** 나온 문제 파일 — 시험별로 */
  const appears = EXAMS.map((e) => ({ exam: e, files: quizSources(e.id).filter((s) => w.occ[e.id]?.[s.id]) })).filter((x) => x.files.length);
  /** 시험별 노트 — 보고 있는 시험 것을 먼저 */
  const notes = [...(w.notes ?? [])].sort((a, b) => Number(b.cat === pref.cat) - Number(a.cat === pref.cat));
  const md = {
    body: { color: c.text2, fontSize: 15, lineHeight: 23 },
    heading2: { color: c.muted, fontSize: 13, fontWeight: '700' as const, marginTop: 14, marginBottom: 4 },
    strong: { color: c.text, fontWeight: '700' as const },
    code_inline: { backgroundColor: c.surface3, color: c.text, fontFamily: 'Menlo', fontSize: 13 },
    blockquote: { backgroundColor: c.surface2, borderLeftColor: c.separator, borderLeftWidth: 3, paddingHorizontal: 10, marginVertical: 4 },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
  };

  return (
    <ExamPrefProvider pref={pref}>
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: w.word, headerRight: () => <SpeakButton text={w.word} size={20} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}>
        {/* 머리 */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {!!w.ipa && <Text style={[type.title3, { color: c.muted, fontWeight: '400' }]}>/{w.ipa}/</Text>}
            {w.pos.map((p) => (
              <PosBadge key={p} pos={p} />
            ))}
            <StatusBadge status={status} />
            <MiniTag label={`${w.level}단계 · ${levelName(w.level)}`} />
            {isExtra(w) && <MiniTag label="확장" />}
          </View>
          <T v="title2" color="primaryText" style={{ lineHeight: 29 }}>
            {w.short}
          </T>
          {w.meaning !== w.short && (
            <T v="callout" color="text2" style={{ lineHeight: 23 }}>
              {w.meaning}
            </T>
          )}
        </View>

        {w.senses.length > 1 && (
          <Card style={{ padding: 16 }}>
            <SectionLabel>여러 뜻</SectionLabel>
            <SenseList w={w} />
          </Card>
        )}

        {!!w.memory && (
          <Card style={{ padding: 16 }}>
            <SectionLabel>외우기 · 어원과 연상</SectionLabel>
            <MemoryAid w={w} linkFamily />
          </Card>
        )}

        {/* 문제 속 뜻과 예문 */}
        <View>
          <SectionLabel right={freqLabel ? <T v="caption" color="muted">{freqLabel}</T> : undefined}>문제 속 뜻과 예문</SectionLabel>
          {contexts.length === 0 && (
            <T v="subhead" color="muted" style={{ paddingHorizontal: 4 }}>
              문제에 나온 예문이 없어요.
            </T>
          )}
          <View style={{ gap: 16 }}>
            {groups.map((g, gi) => (
              <View key={gi} style={{ gap: 8 }}>
                {!!g.sense && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
                    <T v="headline" style={{ flexShrink: 1 }}>
                      {g.sense}
                    </T>
                    {!!g.pos && <PosBadge pos={g.pos} small />}
                  </View>
                )}
                {g.items.map((ctx, i) => (
                  <ContextCard key={i} c={ctx} showSense={false} index={gi + i} />
                ))}
              </View>
            ))}
          </View>
          {w.freq > contexts.length && (
            <Pressable onPress={() => setMoreOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4 }}>
              <Icon name={moreOpen ? 'chevron.up' : 'chevron.down'} size={12} color={c.primary} />
              <T v="subhead" color="primary" style={{ fontWeight: '600' }}>
                다른 문제 속 예문 {moreOpen ? '접기' : '더 보기'}
              </T>
            </Pressable>
          )}
          {moreOpen && (
            <View style={{ gap: 10 }}>
              {more.map((ctx, i) => (
                <ContextCard key={i} c={ctx} showSense={false} index={i} />
              ))}
              {!more.length && <T v="subhead" color="muted">더 찾은 예문이 없어요.</T>}
            </View>
          )}
        </View>

        {/* 변화형·유의어·출처 */}
        {(!!w.forms?.length || !!w.synonyms?.length || appears.length > 0) && (
          <Card style={{ padding: 16, gap: 16 }}>
            {!!w.forms?.length && (
              <View>
                <SectionLabel>변화형·파생어</SectionLabel>
                <Wrap items={w.forms} />
              </View>
            )}
            {!!w.synonyms?.length && (
              <View>
                <SectionLabel>비슷한 말</SectionLabel>
                <View style={styles.wrap}>
                  {w.synonyms.map((s) => {
                    const t = WORD_BY_SURFACE.get(s.toLowerCase());
                    const link = t && t.id !== w.id;
                    return (
                      <Pressable key={s} disabled={!link} onPress={() => link && router.push({ pathname: '/word/[id]', params: { id: t.id } })} style={[styles.tag, { backgroundColor: link ? c.primarySoft : c.surface2 }]}>
                        <Text style={{ fontSize: 14, color: link ? c.primaryText : c.text, fontWeight: link ? '600' : '400' }}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {appears.map(({ exam, files }) => (
              <View key={exam.id}>
                <SectionLabel>{EXAMS.length > 1 ? `나온 문제 파일 · ${exam.name}` : '나온 문제 파일'}</SectionLabel>
                <Wrap items={files.map((s) => s.name)} />
              </View>
            ))}
          </Card>
        )}

        {notes.map((n) => (
          <Card key={n.cat} style={{ padding: 16 }}>
            <SectionLabel>{examName(n.cat)} 노트</SectionLabel>
            <Markdown style={md}>{n.md}</Markdown>
          </Card>
        ))}

        {/* 학습 기록 */}
        <Card style={[styles.stats, dark && { borderColor: c.separator }]}>
          <Stat label="다음 복습" value={card ? relativeDue(new Date(card.due)) : '학습 전'} />
          <Stat label="맞힘 / 틀림" value={`${history?.ok ?? 0} / ${history?.ng ?? 0}`} />
          <Stat label="기억 안정도" value={card ? `${card.stability.toFixed(1)}일` : '—'} />
        </Card>
      </ScrollView>

      {/* 하단 툴바 */}
      <View style={[styles.toolbar, { paddingBottom: Math.max(14, insets.bottom), backgroundColor: c.bg, borderTopColor: c.separator }]}>
        <Button
          title={inWrong ? '오답노트에서 빼기' : '오답노트에 담기'}
          icon={inWrong ? 'bookmark.slash' : 'bookmark'}
          variant={inWrong ? 'danger' : 'secondary'}
          style={{ flex: 1 }}
          onPress={() => {
            if (inWrong) removeWrong(w.id);
            else addWrong(w.id);
            void haptic.success();
            toast(inWrong ? '오답노트에서 뺐어요' : '오답노트에 담았어요');
          }}
        />
        <Button
          title="카드로 보기"
          icon="rectangle.stack"
          variant="tinted"
          style={{ flex: 1 }}
          onPress={() => router.push(`${sessionHref('flash', { ...DEFAULT_SCOPE, set: 'all', status: 'any', count: 0 })}&ids=${w.id}` as never)}
        />
      </View>
    </View>
    </ExamPrefProvider>
  );
}

function MiniTag({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface3, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.muted }}>{label}</Text>
    </View>
  );
}

function Wrap({ items }: { items: string[] }) {
  const { c } = useTheme();
  return (
    <View style={styles.wrap}>
      {items.map((s) => (
        <View key={s} style={[styles.tag, { backgroundColor: c.surface2 }]}>
          <Text style={{ fontSize: 14, color: c.text }}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <T v="caption" color="muted">
        {label}
      </T>
      <T v="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  stats: { flexDirection: 'row', padding: 16, gap: 10 },
  toolbar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
