/**
 * 아이콘 (안드로이드) — SF Symbols 가 없으므로 같은 이름을 Material Community Icons 로 바꿔 그린다.
 * 앱에서 쓰는 이름만 대응표에 있다. 새 SF Symbol 을 쓰면 여기에도 한 줄 더한다 (없으면 물음표 동그라미가 나온다).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useTheme } from '@/theme';

type MdName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const MD_ICON: Partial<Record<SFSymbol, MdName>> = {
  'arrow.counterclockwise': 'replay',
  'arrow.right': 'arrow-right',
  'arrow.triangle.merge': 'call-merge',
  'arrow.up': 'arrow-up',
  'book.closed': 'book-outline',
  'book.closed.fill': 'book',
  bookmark: 'bookmark-outline',
  'bookmark.fill': 'bookmark',
  'bookmark.slash': 'bookmark-off-outline',
  'books.vertical': 'bookshelf',
  'books.vertical.fill': 'bookshelf',
  'brain.head.profile': 'brain',
  checkmark: 'check',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.seal': 'check-decagram-outline',
  'chevron.down': 'chevron-down',
  'chevron.right': 'chevron-right',
  'chevron.up': 'chevron-up',
  circle: 'circle-outline',
  'doc.on.doc': 'content-copy',
  'ellipsis.circle': 'dots-horizontal-circle-outline',
  gearshape: 'cog-outline',
  house: 'home-outline',
  'house.fill': 'home',
  'lightbulb.fill': 'lightbulb',
  'list.bullet': 'format-list-bulleted',
  'list.bullet.rectangle': 'list-box-outline',
  'list.bullet.rectangle.fill': 'list-box',
  magnifyingglass: 'magnify',
  minus: 'minus',
  'play.fill': 'play',
  plus: 'plus',
  'plus.circle': 'plus-circle-outline',
  'questionmark.circle': 'help-circle-outline',
  'rectangle.stack': 'cards-outline',
  'rectangle.stack.fill': 'cards',
  shuffle: 'shuffle-variant',
  'speaker.wave.2.fill': 'volume-high',
  'text.quote': 'format-quote-close',
  trash: 'trash-can-outline',
  'trash.fill': 'trash-can',
  xmark: 'close',
  'xmark.circle.fill': 'close-circle',
};

/** Material 글리프는 상자를 꽉 채우지 않아 SF Symbol 보다 작아 보인다 — 조금 키워 맞춘다 */
const SCALE = 1.15;

export function Icon({ name, size = 20, color }: { name: SFSymbol; size?: number; color?: string; weight?: 'regular' | 'medium' | 'semibold' | 'bold' }) {
  const { c } = useTheme();
  const px = Math.round(size * SCALE);
  return <MaterialCommunityIcons name={MD_ICON[name] ?? 'help-circle-outline'} size={px} color={color ?? c.text} style={{ width: px, height: px, textAlign: 'center' }} />;
}
