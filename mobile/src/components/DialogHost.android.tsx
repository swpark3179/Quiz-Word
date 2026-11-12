/**
 * 앱 대화상자 (안드로이드) — iOS 의 액션 시트 · 입력창(Alert.prompt) · 버튼 여러 개짜리 확인창을 대신한다.
 * lib/sheet.android.ts 가 dialogStore 에 넣은 것을 화면 맨 위(Modal)에 그린다. 한 번에 하나만 띄운다.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDialog, type Dialog } from '@/lib/dialogStore';
import { type, useTheme } from '@/theme';

export function DialogHost() {
  const current = useDialog((s) => s.current);
  const close = useDialog((s) => s.close);
  // 닫히는 동안에도 내용이 남아 있도록 마지막 대화상자를 기억한다
  const [shown, setShown] = useState<Dialog | null>(current);
  useEffect(() => {
    if (current) setShown(current);
  }, [current]);

  /** 먼저 닫고 나서 부른다 — 콜백이 다음 대화상자를 띄울 수 있다 (메뉴 → 이름 바꾸기 입력창) */
  const finish = (after?: () => void) => {
    close();
    after?.();
  };
  const dismiss = () => {
    const d = current;
    if (!d) return;
    if (d.kind === 'sheet') finish(d.cancelButtonIndex === undefined ? undefined : () => d.onPick(d.cancelButtonIndex!));
    else if (d.kind === 'alert') finish(d.buttons.find((b) => b.style === 'cancel')?.onPress);
    else finish();
  };

  const d = current ?? shown;
  return (
    <Modal visible={!!current} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      {d?.kind === 'sheet' && <Sheet d={d} finish={finish} dismiss={dismiss} />}
      {d?.kind === 'prompt' && <Prompt key={d.title + (d.defaultValue ?? '')} d={d} finish={finish} dismiss={dismiss} />}
      {d?.kind === 'alert' && <Buttons d={d} finish={finish} dismiss={dismiss} />}
    </Modal>
  );
}

type Part<K extends Dialog['kind']> = { d: Extract<Dialog, { kind: K }>; finish: (after?: () => void) => void; dismiss: () => void };

function Head({ title, message }: { title?: string; message?: string }) {
  const { c } = useTheme();
  if (!title && !message) return null;
  return (
    <View style={styles.head}>
      {!!title && <Text style={[type.headline, { color: c.text }]}>{title}</Text>}
      {!!message && <Text style={[type.subhead, { color: c.text2, lineHeight: 21 }]}>{message}</Text>}
    </View>
  );
}

/** 아래에서 올라오는 선택 메뉴 */
function Sheet({ d, finish, dismiss }: Part<'sheet'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { justifyContent: 'flex-end' }]}>
      <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={dismiss} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]}>
        <Head title={d.title} message={d.message} />
        <ScrollView style={{ flexGrow: 0 }} bounces={false}>
          {d.options.map((label, i) =>
            i === d.cancelButtonIndex ? null : (
              <Pressable
                key={`${i}:${label}`}
                accessibilityRole="button"
                android_ripple={{ color: c.surface3 }}
                onPress={() => finish(() => d.onPick(i))}
                style={[styles.option, { borderTopColor: c.separator }]}
              >
                <Text style={[type.body, { color: i === d.destructiveButtonIndex ? c.danger : c.text }]}>{label}</Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        {d.cancelButtonIndex !== undefined && (
          <Pressable accessibilityRole="button" android_ripple={{ color: c.surface3 }} onPress={dismiss} style={[styles.option, { borderTopColor: c.separator }]}>
            <Text style={[type.headline, { color: c.primary }]}>{d.options[d.cancelButtonIndex]}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** 한 줄 입력창 */
function Prompt({ d, finish, dismiss }: Part<'prompt'>) {
  const { c } = useTheme();
  const [text, setText] = useState(d.defaultValue ?? '');
  const submit = () => finish(() => d.onSubmit(text));
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, styles.center]}>
      <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={dismiss} accessibilityLabel="닫기" />
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <Head title={d.title} message={d.message} />
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          placeholderTextColor={c.muted}
          selectionColor={c.primary}
          style={[type.body, styles.input, { color: c.text, backgroundColor: c.surface2 }]}
        />
        <View style={styles.actions}>
          <TextButton label={d.cancelText} color={c.text2} onPress={dismiss} />
          <TextButton label={d.confirmText} color={c.primary} bold onPress={submit} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** 버튼을 세로로 쌓은 확인창 */
function Buttons({ d, finish, dismiss }: Part<'alert'>) {
  const { c } = useTheme();
  return (
    <View style={[styles.fill, styles.center]}>
      <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={dismiss} accessibilityLabel="닫기" />
      <View style={[styles.card, { backgroundColor: c.surface, paddingBottom: 8 }]}>
        <Head title={d.title} message={d.message} />
        {d.buttons.map((b, i) => (
          <Pressable
            key={`${i}:${b.text}`}
            accessibilityRole="button"
            android_ripple={{ color: c.surface3 }}
            onPress={() => finish(b.onPress ? () => b.onPress!() : undefined)}
            style={[styles.option, { borderTopColor: c.separator }]}
          >
            <Text style={[b.style === 'cancel' ? type.headline : type.body, { color: b.style === 'destructive' ? c.danger : b.style === 'cancel' ? c.primary : c.text }]}>{b.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TextButton({ label, color, bold, onPress }: { label: string; color: string; bold?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" android_ripple={{ color: c.surface3, borderless: true }} onPress={onPress} hitSlop={6} style={styles.textBtn}>
      <Text style={{ fontSize: 16, fontWeight: bold ? '700' : '500', color }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', paddingHorizontal: 28 },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', overflow: 'hidden' },
  card: { borderRadius: 24, overflow: 'hidden', maxHeight: '80%' },
  head: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14, gap: 6 },
  option: { minHeight: 54, paddingHorizontal: 22, paddingVertical: 14, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  input: { marginHorizontal: 18, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  textBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
});
