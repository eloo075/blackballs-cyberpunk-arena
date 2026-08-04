'use client';

/** Cross-tab coordination for demo wallets — one leader boot, broadcast balance/actions. */

export type DemoTabMessage =
  | { type: 'balance'; address: string; balance: number }
  | { type: 'refresh'; address: string; game: 'crash' | 'flip' | 'both' }
  | { type: 'action'; address: string; action: string };

const TAB_ID =
  typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('bb-tab-id') ??
        (() => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          sessionStorage.setItem('bb-tab-id', id);
          return id;
        })())
    : 'server';

const LEADER_HEARTBEAT_MS = 2500;

function leaderKey(address: string): string {
  return `bb-demo-leader:${address}`;
}

function channelName(address: string): string {
  return `bb-demo-${address}`;
}

let broadcastChannel: BroadcastChannel | null = null;
let channelAddress: string | null = null;

function getChannel(address: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (broadcastChannel && channelAddress === address) return broadcastChannel;
  try {
    broadcastChannel?.close();
    broadcastChannel = new BroadcastChannel(channelName(address));
    channelAddress = address;
    return broadcastChannel;
  } catch {
    return null;
  }
}

function readLeaderRecord(address: string): { tabId: string; at: number } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed = localStorage.getItem(leaderKey(address));
    if (parsed) return JSON.parse(parsed) as { tabId: string; at: number };
  } catch {
    /* ignore */
  }
  return null;
}

/** True if this tab should boot game sessions (avoid N tabs overwriting server state). */
export function isDemoTabLeader(address: string | null | undefined): boolean {
  if (!address || address.startsWith('0x')) return true;
  if (typeof localStorage === 'undefined') return true;

  const now = Date.now();
  const raw = readLeaderRecord(address);

  if (raw && raw.tabId !== TAB_ID && now - raw.at < LEADER_HEARTBEAT_MS * 2) {
    return false;
  }

  try {
    localStorage.setItem(leaderKey(address), JSON.stringify({ tabId: TAB_ID, at: now }));
  } catch {
    return true;
  }
  return true;
}

/** Heartbeat — call while wallet connected so this tab stays leader if active. */
export function heartbeatDemoTabLeader(address: string | null | undefined): void {
  if (!address || address.startsWith('0x')) return;
  if (typeof localStorage === 'undefined') return;
  const raw = readLeaderRecord(address);
  const now = Date.now();
  if (raw && raw.tabId !== TAB_ID && now - raw.at < LEADER_HEARTBEAT_MS * 2) return;
  try {
    localStorage.setItem(leaderKey(address), JSON.stringify({ tabId: TAB_ID, at: now }));
  } catch {
    /* ignore */
  }
}

export function broadcastDemoTabMessage(address: string, msg: DemoTabMessage): void {
  const ch = getChannel(address);
  ch?.postMessage(msg);
}

export function subscribeDemoTabMessages(
  address: string | null | undefined,
  handler: (msg: DemoTabMessage) => void,
): () => void {
  if (!address || address.startsWith('0x')) return () => {};
  const ch = getChannel(address);
  if (!ch) return () => {};

  const listener = (ev: MessageEvent<DemoTabMessage>) => {
    if (!ev.data || ev.data.address !== address) return;
    handler(ev.data);
  };
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

export function notifyDemoBalance(address: string, balance: number): void {
  broadcastDemoTabMessage(address, { type: 'balance', address, balance });
}

export function notifyDemoRefresh(
  address: string,
  game: 'crash' | 'flip' | 'both' = 'both',
): void {
  broadcastDemoTabMessage(address, { type: 'refresh', address, game });
}
