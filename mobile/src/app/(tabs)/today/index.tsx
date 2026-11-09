/** 오늘 — 복습 히어로, 진척 링, 바로 시작 타일, 7일 막대, 파일별 진척 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { reviewPlan } from '@shared/reviewPlan';
import { statusOf } from '@shared/srs';
import { dayKey, daysUntil } from '@shared/text';
import { CountUp, GrowBar, ProgressRing } from '@/components/motion';
import { Card, Icon, PressableScale, SectionLabel, T } from '@/components/ui';
import { QUIZ_SOURCES, WORDS } from '@/data/words';
import { MODE_INFO, scopeOf, sessionHref, useScopes } from '@/store/session';
import { useProgress } from '@/store/progress';
import { DEFAULT_SCOPE } from '@shared/scope';
import { elevation, type, useTheme } from '@/theme';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export default function Today() {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const cards = useProgress((s) => s.cards);
  const wrong = useProgress((s) => s.wrong);
  const days = useProgress((s) => s.days);
  const settings = useProgress((s) => s.settings);
  const scopes = useScopes((s) => s.scopes);
  const [filesOpen, setFilesOpen] = useState(false);

  const today = new Date();
  const todayLog = days[dayKey(today)];
  const plan = useMemo(() => reviewPlan(WORDS, cards, settings.newPerDay, todayLog?.newWords ?? 0), [cards, settings.newPerDay, todayLog?.newWords]);
  const examLeft = settings.examDate ? daysUntil(settings.examDate) : undefined;
  const wrongN = Object.keys(wrong).length;

  const progress = useMemo(() => {
    const core = WORDS.filter((w) => w.tier === 'core' && !w.basic);
    const count = { new: 0, learning: 0, mastered: 0 };
    for (const w of core) count[statusOf(cards[w.id])]++;
    const bySource = QUIZ_SOURCES.map((s) => {
      const ws = core.filter((w) => w.sources.includes(s.id));
      return {
        ...s,
        total: ws.length,
        done: ws.filter((w) => statusOf(cards[w.id]) !== 'new').length,
        mastered: ws.filter((w) => statusOf(cards[w.id]) === 'mastered').length,
      };
    }).filter((s) => s.total >= 10);
    return { total: core.length, ...count, bySource };
  }, [cards]);

  const week = useMemo(() => {
    const out: { key: string; label: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const k = dayKey(d);
      out.push({ key: k, label: i === 0 ? '오늘' : WEEKDAY[d.getDay()], n: days[k]?.reviews ?? 0 });
    }
    return out;
  }, [days]);
  const maxWeek = Math.max(1, ...week.map((d) => d.n));
  const total = plan.due.length + plan.fresh.length;
  const studied = progress.learning + progress.mastered;

  const tiles = [
    { key: 'flash', icon: MODE_INFO.flash.icon, title: '플래시카드', sub: scopeOf('flash', scopes).count ? `${scopeOf('flash', scopes).count}장` : '전부', onPress: () => router.push({ pathname: '/scope', params: { mode: 'flash' } }) },
    { key: 'quiz', icon: MODE_INFO['quiz-meaning'].icon, title: '객관식', sub: '단어 → 뜻', onPress: () => router.push({ pathname: '/scope', params: { mode: 'quiz-meaning' } }) },
    { key: 'ctx', icon: MODE_INFO['quiz-context'].icon, title: '문맥 뜻', sub: '다의어 연습', onPress: () => router.push({ pathname: '/scope', params: { mode: 'quiz-context' } }) },
    {
      key: 'wrong',
      icon: 'bookmark.fill' as const,
      title: '오답 복습',
      sub: wrongN ? `${wrongN}개` : '비어 있음',
      danger: true,
      onPress: () =>
        wrongN
          ? router.push(sessionHref('flash', { ...DEFAULT_SCOPE, set: 'wrong', status: 'any', count: 0, order: 'random', includeBasic: true }) as never)
          : router.push('/wrong'),
    },
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <T v="subhead" color="muted" style={{ marginTop: -4, marginLeft: 4 }}>
        {today.getMonth() + 1}월 {today.getDate()}일 {WEEKDAY[today.getDay()]}요일
        {examLeft !== undefined && examLeft >= 0 ? ` · 시험 D-${examLeft}` : ''}
      </T>

      {/* 오늘의 복습 */}
      <LinearGradient colors={['#4F46E5', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroTitle}>{total ? '오늘의 복습' : '오늘 할 복습을 모두 마쳤어요'}</Text>
        <View style={{ flexDirection: 'row', gap: 28 }}>
          <View>
            <CountUp to={plan.due.length} style={styles.heroNum} />
            <Text style={styles.heroLabel}>복습할 단어</Text>
          </View>
          <View>
            <CountUp to={plan.fresh.length} style={styles.heroNum} />
            <Text style={styles.heroLabel}>새 단어</Text>
          </View>
        </View>
        <PressableScale
          disabled={!total}
          onPress={() => router.push('/session/review?style=flash')}
          style={[styles.heroBtn, { opacity: total ? 1 : 0.5 }]}
          accessibilityRole="button"
        >
          <Icon name="play.fill" size={15} color="#FFFFFF" />
          <Text style={[type.headline, { color: '#FFFFFF' }]}>{total ? '복습 시작' : '복습 완료'}</Text>
        </PressableScale>
      </LinearGradient>

      {/* 핵심 단어 진척 */}
      <Card style={styles.progress}>
        <ProgressRing pct={progress.total ? studied / progress.total : 0} color={c.success}>
          <CountUp to={progress.total ? Math.round((studied / progress.total) * 100) : 0} duration={800} suffix="%" style={[type.headline, { color: c.text }]} />
        </ProgressRing>
        <View style={{ gap: 4, flex: 1 }}>
          <T v="headline">핵심 단어 {progress.total.toLocaleString()}개</T>
          <Legend color={c.success} label={`익힘 ${progress.mastered}`} />
          <Legend color={c.warning} label={`학습 중 ${progress.learning}`} />
          <Legend color={c.separator} label={`새 단어 ${progress.new.toLocaleString()}`} />
        </View>
      </Card>

      {/* 바로 시작 */}
      <View style={styles.tiles}>
        {tiles.map((t, i) => (
          <Animated.View key={t.key} entering={reduced ? undefined : FadeInDown.springify().damping(16).delay(200 + i * 40)} style={{ width: '48.5%' }}>
            <PressableScale onPress={t.onPress} hapticOnPress style={[styles.tile, { backgroundColor: c.surface }, elevation(c, dark)]}>
              <View style={[styles.tileIcon, { backgroundColor: t.danger ? c.dangerSoft : c.primarySoft }]}>
                <Icon name={t.icon} size={16} color={t.danger ? c.danger : c.primary} />
              </View>
              <T v="headline">{t.title}</T>
              <T v="footnote" color="muted">
                {t.sub}
              </T>
            </PressableScale>
          </Animated.View>
        ))}
      </View>

      {/* 최근 7일 */}
      <Card style={{ padding: 16 }}>
        <SectionLabel right={<T v="caption" color="muted">오늘 정답률 {todayLog ? Math.round((todayLog.correct / Math.max(1, todayLog.correct + todayLog.wrong)) * 100) : 0}%</T>}>
          최근 7일 학습량
        </SectionLabel>
        <View style={styles.bars}>
          {week.map((d, i) => (
            <View key={d.key} style={styles.barCol}>
              <T v="caption" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
                {d.n || ''}
              </T>
              <View style={{ height: 72, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                <GrowBar height={(d.n / maxWeek) * 72} index={i} color={c.primary} dim={d.label !== '오늘'} />
              </View>
              <T v="caption" color={d.label === '오늘' ? 'text' : 'muted'} style={{ fontWeight: d.label === '오늘' ? '700' : '400' }}>
                {d.label}
              </T>
            </View>
          ))}
        </View>
      </Card>

      {/* 문제 파일별 진척 */}
      <Card style={{ padding: 16 }}>
        <Pressable onPress={() => setFilesOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="headline">문제 파일별 진척</T>
          <Icon name={filesOpen ? 'chevron.up' : 'chevron.down'} size={14} color={c.muted} />
        </Pressable>
        {filesOpen && (
          <View style={{ gap: 12, marginTop: 14 }}>
            {progress.bySource.map((s) => (
              <Pressable key={s.id} onPress={() => router.push({ pathname: '/words', params: { src: s.id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <T v="footnote" color="text2">
                    {s.name}
                  </T>
                  <T v="footnote" color="muted" style={{ fontVariant: ['tabular-nums'] }}>
                    {s.done} / {s.total}
                  </T>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surface3, flexDirection: 'row', overflow: 'hidden' }}>
                  <View style={{ width: `${(s.mastered / s.total) * 100}%`, backgroundColor: c.success }} />
                  <View style={{ width: `${((s.done - s.mastered) / s.total) * 100}%`, backgroundColor: c.primary, opacity: 0.6 }} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
      <T v="caption" color="muted" style={{ textAlign: 'center', marginTop: 4 }}>
        단어 {WORDS.length.toLocaleString()}개
      </T>
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T v="footnote" color="text2">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  hero: { borderRadius: 24, borderCurve: 'continuous', padding: 20, gap: 14, shadowColor: '#4F46E5', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  heroTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600' },
  heroNum: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', letterSpacing: -0.8 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroBtn: { height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { borderRadius: 18, borderCurve: 'continuous', padding: 14, gap: 6 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 5 },
});
