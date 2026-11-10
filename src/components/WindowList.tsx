/**
 * 페이지 스크롤을 그대로 쓰는 가상 목록 — 화면에 보이는 줄만 DOM 에 둔다.
 * 오답노트·학습장처럼 수백 줄이 될 수 있는 목록에 쓴다. 줄 높이는 그려진 뒤 실제로 재서 맞춘다.
 */
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function WindowList<T>({
  items,
  getKey,
  renderRow,
  estimateSize = 64,
  rowClassName = '',
}: {
  items: T[];
  getKey: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  /** 줄 바깥 상자에 붙일 클래스 (마지막 줄을 뺀 줄에는 구분선이 붙는다) */
  rowClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 목록이 페이지에서 시작하는 위치 — 위쪽 내용이 바뀌면 다시 잰다
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const y = (ref.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (Math.abs(y - top) > 0.5) setTop(y);
  });

  const virtual = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 10,
    scrollMargin: top,
    getItemKey: (i) => getKey(items[i]),
  });

  return (
    <div ref={ref} style={{ height: virtual.getTotalSize(), position: 'relative' }}>
      {virtual.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtual.measureElement}
          className={`absolute left-0 top-0 w-full ${row.index < items.length - 1 ? 'border-b border-line' : ''} ${rowClassName}`}
          style={{ transform: `translateY(${row.start - virtual.options.scrollMargin}px)` }}
        >
          {renderRow(items[row.index], row.index)}
        </div>
      ))}
    </div>
  );
}
