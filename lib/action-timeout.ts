export const ACTION_TIMEOUT_MS = 12000;
export const NETWORK_DELAY_MSG = 'Network delay. Please try again.';

export class ActionTimeoutError extends Error {
  constructor(message = NETWORK_DELAY_MSG) {
    super(message);
    this.name = 'ActionTimeoutError';
  }
}

/** Race an async action against a timeout; aborts fetch via optional signal. */
export async function withActionTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms = ACTION_TIMEOUT_MS,
): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      run(ac.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          ac.abort();
          reject(new ActionTimeoutError());
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  ms = ACTION_TIMEOUT_MS,
): Promise<Response> {
  return withActionTimeout(signal => fetch(url, { ...init, signal }), ms);
}

export function isActionTimeoutError(err: unknown): boolean {
  return err instanceof ActionTimeoutError;
}

export function actionErrorMessage(err: unknown, fallback: string): string {
  if (isActionTimeoutError(err)) return NETWORK_DELAY_MSG;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
