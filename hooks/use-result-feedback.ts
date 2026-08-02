'use client';

import { useCallback, useState } from 'react';
import {
  computeResultIntensity,
  type ResultFeedbackEvent,
  type ResultFeedbackInput,
} from '@/lib/result-feedback-utils';
import { playResultLoseSound, playResultWinSound } from '@/lib/game-sfx';

export function useResultFeedback() {
  const [event, setEvent] = useState<ResultFeedbackEvent | null>(null);

  const trigger = useCallback((input: ResultFeedbackInput) => {
    const intensity = input.intensity ?? computeResultIntensity(input.amount, input.multiplier);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setEvent({
      id,
      won: input.won,
      amount: input.amount,
      subtitle: input.subtitle,
      intensity,
    });
    if (input.won) playResultWinSound(intensity);
    else playResultLoseSound();
  }, []);

  const dismiss = useCallback(() => setEvent(null), []);

  return { event, trigger, dismiss };
}
