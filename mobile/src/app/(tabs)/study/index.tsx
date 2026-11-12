/** 학습 — 모드를 고르면 범위 시트가 열린다 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { reviewPlan } from '@shared/reviewPlan';
import { dayKey } from '@shared/text';
import { Icon, PressableScale, SectionLabel, T } from '@/components/ui';
import { mainExam, WORDS } from '@/data/words';
import { useFocusSnapshot } from '@/lib/useFocusSnapshot';
import { showActionSheet } from '@/lib/sheet';
import { useProgress } from '@/store/progress';
import { MODE_INFO, scopeOf, scopeSummary, useScopes, type StudyMode } from '@/store/session';
import { elevation, useTheme } from '@/theme';

const MODES: StudyMode[] = ['flash', 'quiz-meaning', 'quiz-context', 'quiz-mixed'];

export default function Study() {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const scopes = useScopes((s) => s.scopes);
  // 세션을 띄운 동안(이 탭이 가려진 동안)은 판정마다 복습 계획을 다시 계산하지 않는다
  const cards = useFocusSnapshot(useProgress((s) => s.cards));
  const settings = useProgress((s) => s.settings);
  const todayNew = useFocusSnapshot(useProgress((s) => s.days[dayKey()]?.newWords ?? 0));
  const plan = useMemo(
    () => reviewPlan(WORDS, cards, settings.newPerDay, todayNew, new Date(), { cat: mainExam(settings.exam), minLevel: settings.minLevel }),
    [cards, settings.newPerDay, settings.exam, settings.minLevel, todayNew],
  );
  const reviewTotal = plan.due.length + plan.fresh.length;

  const startReview = () =>
    showActionSheet(
      { title: `복습 ${plan.due.length}개 + 새 단어 ${plan.fresh.length}개`, options: ['플래시카드로 복습', '객관식으로 복습', '취소'], cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) router.push('/session/review?style=flash');
        if (i === 1) router.push('/session/review?style=quiz');
      },
    );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
        <PressableScale disabled={!reviewTotal} onPress={startReview} hapticOnPress style={[styles.review, { backgroundColor: c.primary, opacity: reviewTotal ? 1 : 0.55 }]}>
          <View style={[styles.icon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Icon name="brain.head.profile" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <T v="headline" style={{ color: '#FFFFFF' }}>
              간격 반복 복습
            </T>
            <T v="footnote" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              {reviewTotal ? `복습 ${plan.due.length}개 · 새 단어 ${plan.fresh.length}개` : '오늘 할 복습을 모두 마쳤어요'}
            </T>
          </View>
          <Icon name="chevron.right" size={14} color="#FFFFFF" />
        </PressableScale>
      </Animated.View>

      <SectionLabel>모드 고르기</SectionLabel>
      {MODES.map((m, i) => (
        <Animated.View key={m} entering={reduced ? undefined : FadeInDown.springify().damping(16).delay(60 + i * 40)}>
          <PressableScale
            onPress={() => router.push({ pathname: '/scope', params: { mode: m } })}
            hapticOnPress
            style={[styles.card, { backgroundColor: c.surface }, elevation(c, dark)]}
          >
            <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
              <Icon name={MODE_INFO[m].icon} size={19} color={c.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="headline">{MODE_INFO[m].title}</T>
              <T v="footnote" color="text2">
                {MODE_INFO[m].desc}
              </T>
              <T v="caption" color="muted" style={{ marginTop: 3 }}>
                {scopeSummary(scopeOf(m, scopes))}
              </T>
            </View>
            <Icon name="chevron.right" size={13} color={c.muted} />
          </PressableScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 10 },
  review: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderCurve: 'continuous', marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderCurve: 'continuous' },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
