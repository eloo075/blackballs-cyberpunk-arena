'use client';

import { useEffect, useRef, useState } from 'react';

const DRAFT_RE = /^\d*\.?\d*$/;

interface BetAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  /** Fires on every keystroke with the raw draft (for buy-gating while typing). */
  onDraftChange?: (draft: string) => void;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** When false, typing is not capped to `max` (MAX button still uses balance). */
  clampToMax?: boolean;
}

function formatDraft(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  if (value === 0) return '0';
  const s = value.toFixed(decimals);
  return s.replace(/\.?0+$/, '') || s;
}

function clampAmount(raw: number, min: number, max: number, decimals: number): number {
  let n = raw;
  if (Number.isNaN(n)) n = 0;
  n = Math.min(max, Math.max(min, n));
  const factor = 10 ** decimals;
  return Math.floor(n * factor) / factor;
}

function roundAmount(raw: number, decimals: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  const factor = 10 ** decimals;
  return Math.floor(raw * factor) / factor;
}

export function BetAmountInput({
  value,
  onChange,
  onDraftChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  clampToMax = true,
  decimals = 3,
  disabled,
  placeholder = '0',
  className,
  'aria-label': ariaLabel,
}: BetAmountInputProps) {
  const [draft, setDraft] = useState(() => formatDraft(value, decimals));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      const next = formatDraft(value, decimals);
      setDraft(next);
      onDraftChange?.(next);
    }
    // Intentionally omit onDraftChange — parent setters are stable; avoid draft echo loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, decimals]);

  const applyParsed = (trimmed: string) => {
    if (trimmed === '' || trimmed === '.') {
      onChange(0);
      setDraft(trimmed === '.' ? '.' : '');
      onDraftChange?.(trimmed === '.' ? '.' : '0');
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      onChange(0);
      return;
    }
    const nextVal = clampToMax
      ? clampAmount(parsed, min, max, decimals)
      : roundAmount(Math.max(min, parsed), decimals);
    onChange(nextVal);
    // Cap live in the field — no blur/confirm needed when over max/balance.
    if (clampToMax && parsed > max + 1e-12) {
      const capped = formatDraft(nextVal, decimals);
      setDraft(capped);
      onDraftChange?.(capped);
      return;
    }
    onDraftChange?.(trimmed);
  };

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '.') {
      onChange(0);
      setDraft('0');
      onDraftChange?.('0');
      return;
    }
    const parsed = parseFloat(trimmed);
    const nextVal = clampToMax
      ? clampAmount(parsed, min, max, decimals)
      : roundAmount(Math.max(min, parsed), decimals);
    onChange(nextVal);
    const next = formatDraft(nextVal, decimals);
    setDraft(next);
    onDraftChange?.(next);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={focused ? draft : formatDraft(value, decimals)}
      onFocus={() => {
        setFocused(true);
        const next = formatDraft(value, decimals);
        setDraft(next);
        onDraftChange?.(next);
        requestAnimationFrame(() => inputRef.current?.select());
      }}
      onChange={e => {
        const next = e.target.value;
        if (!DRAFT_RE.test(next)) return;
        setDraft(next);
        applyParsed(next.trim());
      }}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
