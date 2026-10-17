import { useEffect, useState } from 'react';
import { fromDateInputValue, toDateInputValue } from '@/lib/dates';

type Props = {
  value: string | Date | null | undefined;
  onCommit: (isoLocalNoon: string | null) => void;
  className?: string;
  title?: string;
};

/**
 * Native date input that commits on blur/change-complete so React Query
 * invalidation doesn't close the picker mid-selection.
 */
export function DateField({ value, onCommit, className, title }: Props) {
  const [local, setLocal] = useState(() => toDateInputValue(value));

  useEffect(() => {
    setLocal(toDateInputValue(value));
  }, [value]);

  function commit(next: string) {
    const prev = toDateInputValue(value);
    if (next === prev) return;
    onCommit(fromDateInputValue(next));
  }

  return (
    <input
      type="date"
      title={title || 'Tarih seç'}
      className={className}
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        // Chromium fires change when a day is picked (picker closes) — safe to commit
        commit(v);
      }}
      onBlur={(e) => commit(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
