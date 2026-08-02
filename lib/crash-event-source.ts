/** Detach handlers before close so reconnects never accumulate ghost listeners. */
export function teardownEventSource(source: EventSource | null): void {
  if (!source) return;
  source.onopen = null;
  source.onmessage = null;
  source.onerror = null;
  source.close();
}
