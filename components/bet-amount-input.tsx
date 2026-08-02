'use client';

import { useEffect, useRef, useState } from 'react';

const DRAFT_RE = /^\d*\.?\d*$/;

interface BetAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

function formatDraft(value: number, decimals: number): string {
  if (value <= 0) return '';
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

export function BetAmountInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  decimals = 3,
  disabled,
  placeholder = '0',
  className,
  'aria-label': ariaLabel,
}: BetAmountInputProps) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setDraft(value > 0 ? formatDraft(value, decimals) : '');
    }
  }, [value, focused, decimals]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '.') {
      onChange(0);
      setDraft('');
      return;
    }
    const parsed = clampAmount(parseFloat(trimmed), min, max, decimals);
    onChange(parsed);
    setDraft(parsed > 0 ? formatDraft(parsed, decimals) : '');
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
      value={focused ? draft : value > 0 ? formatDraft(value, decimals) : ''}
      onFocus={() => {
        setFocused(true);
        setDraft(value > 0 ? formatDraft(value, decimals) : '');
        requestAnimationFrame(() => inputRef.current?.select());
      }}
      onChange={e => {
        const next = e.target.value;
        if (DRAFT_RE.test(next)) setDraft(next);
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
