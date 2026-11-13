/** 학습장 합치기 시트 (formSheet) — 둘 이상 골라 단어 합집합(겹치는 단어는 한 번만)으로 새 학습장. 기존 학습장은 남기거나 지운다 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanNotebookName, mergedNotebookName, mergeNotebookIds, NOTEBOOK_NAME_MAX } from '@shared/notebook';
import { useToast } from '@/components/motion';
import { Button, Icon, Segmented, T } from '@/components/ui';
import { WORD_BY_ID } from '@/data/words';
import { useProgress } from '@/store/progress';
import { startFromSheet } from '@/store/session';
import { SHEET_IS_SCREEN, sheetFooterPad, type, useTheme } from '@/theme';
import { haptic } from '@/theme/haptics';

/** 지금 단어 데이터에 있는 단어만 센다 */
const knownCount = (ids: string[]) => ids.reduce((n, id) => n + (WORD_BY_ID.has(id) ? 1 : 0), 0);

export default function NotebookMergeSheet() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const notebooks = useProgress((s) => s.notebooks);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  /** 직접 고친 이름 — 고치기 전까지는 고른 학습장에 맞춘 기본 이름을 따라간다 */
  const [typed, setTyped] = useState<string | null>(null);
  const [sources, setSources] = useState<'keep' | 'delete'>('keep');

  // 학습장 목록 순서대로 — 스토어가 합치는 순서와 같다
  const chosen = useMemo(() => notebooks.filter((n) => picked.has(n.id)), [notebooks, picked]);
  const suggested = mergedNotebookName(chosen);
  const { total, overlap } = useMemo(() => {
    const total = knownCount(mergeNotebookIds(chosen));
    return { total, overlap: chosen.reduce((sum, n) => sum + knownCount(n.ids), 0) - total };
  }, [chosen]);
  const ready = chosen.length >= 2;
  const remove = sources === 'delete';

  const toggle = (id: string) => {
    void haptic.select();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const merge = () => {
    if (!ready) return;
    const name = cleanNotebookName(typed ?? suggested, suggested);
    const id = useProgress.getState().mergeNotebooks(
      chosen.map((n) => n.id),
      name,
      { deleteSources: remove },
    );
    if (!id) return;
    void haptic.success();
    useToast.getState().show(`'${name}' 단어 ${total}개로 합쳤어요`);
    startFromSheet(`/notebooks/${id}`);
  };

  return (
    <View style={{ flex: 1, paddingTop: SHEET_IS_SCREEN ? insets.top : 0 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 150 + sheetFooterPad(insets.bottom) }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ gap: 4 }}>
          <T v="title2">학습장 합치기</T>
          <T v="subhead" color="text2">
            고른 학습장의 단어를 겹치지 않게 모아 새 학습장을 만들어요.
          </T>
        </View>

        <View style={{ gap: 9 }}>
          <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
            합칠 학습장 · 2개 이상
          </T>
          <View style={[styles.group, { backgroundColor: c.surface }]}>
            {notebooks.map((nb, i) => {
              const on = picked.has(nb.id);
              const n = knownCount(nb.ids);
              return (
                <Pressable
                  key={nb.id}
                  onPress={() => toggle(nb.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${nb.name}, 단어 ${n}개`}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? c.surface2 : 'transparent' },
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
                  ]}
                >
                  <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={22} color={on ? c.primary : c.muted} weight="regular" />
                  <T v="body" numberOfLines={1} style={{ flex: 1, fontWeight: on ? '600' : '400' }}>
                    {nb.name}
                  </T>
                  <T v="footnote" color="muted">
                    {n}개
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 9 }}>
          <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
            새 학습장 이름
          </T>
          <TextInput
            value={typed ?? (chosen.length ? suggested : '')}
            onChangeText={setTyped}
            placeholder={suggested}
            placeholderTextColor={c.muted}
            maxLength={NOTEBOOK_NAME_MAX}
            clearButtonMode="while-editing"
            returnKeyType="done"
            accessibilityLabel="새 학습장 이름"
            style={[type.body, styles.input, { backgroundColor: c.surface, color: c.text }]}
          />
        </View>

        <View style={{ gap: 9 }}>
          <T v="footnote" color="muted" style={{ fontWeight: '700' }}>
            기존 학습장
          </T>
          <Segmented
            value={sources}
            options={[
              { value: 'keep', label: '남겨두기' },
              { value: 'delete', label: '삭제하기' },
            ]}
            onChange={setSources}
          />
          <T v="footnote" color={remove ? 'danger' : 'muted'}>
            {remove
              ? `합친 뒤 고른 ${chosen.length ? `${chosen.length}개 ` : ''}학습장은 지워져요. 단어는 모두 새 학습장에 담기고, 학습 기록은 그대로 남아요.`
              : '고른 학습장은 그대로 두고 새 학습장을 하나 더 만들어요.'}
          </T>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: sheetFooterPad(insets.bottom), backgroundColor: c.bg, borderTopColor: c.separator }]}>
        <T v="footnote" color="text2" style={{ textAlign: 'center' }}>
          {ready ? (
            <>
              합치면 단어 <T v="footnote" style={{ fontWeight: '700' }}>{total.toLocaleString()}</T>개
              {overlap > 0 ? ` · 겹치는 ${overlap}개는 한 번만` : ''}
            </>
          ) : (
            `학습장을 ${2 - chosen.length}개 더 고르세요`
          )}
        </T>
        <Button
          title={ready ? (remove ? `합치고 기존 ${chosen.length}개 삭제` : `${chosen.length}개 학습장 합치기`) : '학습장 합치기'}
          icon="arrow.triangle.merge"
          variant={remove ? 'danger' : 'primary'}
          big
          disabled={!ready}
          onPress={merge}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 26, gap: 22 },
  group: { borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderCurve: 'continuous' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
