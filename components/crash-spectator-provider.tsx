'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useCrashSpectatorChannel,
  type SpectatorToast,
} from '@/hooks/use-crash-spectator-channel';
import type { CrashSpectatorEvent } from '@/lib/crash-spectator-types';

interface CrashSpectatorContextValue {
  events: CrashSpectatorEvent[];
  toasts: SpectatorToast[];
  dismissToast: (id: string) => void;
  realtimeEnabled: boolean;
}

const CrashSpectatorContext = createContext<CrashSpectatorContextValue | null>(null);

export function CrashSpectatorProvider({ children }: { children: ReactNode }) {
  const value = useCrashSpectatorChannel();
  return (
    <CrashSpectatorContext.Provider value={value}>{children}</CrashSpectatorContext.Provider>
  );
}

export function useCrashSpectator() {
  const ctx = useContext(CrashSpectatorContext);
  if (!ctx) {
    throw new Error('useCrashSpectator must be used within CrashSpectatorProvider');
  }
  return ctx;
}
