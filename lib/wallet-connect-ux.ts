import { REQUIRE_GAME_CHAIN } from '@/lib/launch-surface';
import { robinhoodChain } from '@/lib/wagmi/chains';

/** In demo-rewards, the wallet is identity-only — never ask the wallet to switch chains. */
export function walletConnectParams<T>(connector: T): { connector: T; chainId?: number } {
  if (REQUIRE_GAME_CHAIN) {
    return { connector, chainId: robinhoodChain.id };
  }
  return { connector };
}

export function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

export function getWalletConnectProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';
  return /^[a-f0-9]{32}$/i.test(id) ? id : null;
}

/** In-app wallet browsers inject a provider even on phones. */
export function shouldShowInjectedConnect(isMobile: boolean, injectedAvailable: boolean): boolean {
  if (injectedAvailable) return true;
  return !isMobile;
}

export function friendlyWalletConnectError(raw: string): string {
  const message = (raw ?? '').trim();
  const lower = message.toLowerCase();
  if (
    lower.includes('provider not found') ||
    lower.includes('connector not found') ||
    lower.includes('@wagmi/core')
  ) {
    return 'No wallet detected — connect with WalletConnect or open this page in your wallet app.';
  }
  if (lower.includes('user rejected') || lower.includes('rejected the request') || lower.includes('denied')) {
    return 'Connection cancelled.';
  }
  if (lower.includes('project id') || lower.includes('projectid')) {
    return 'WalletConnect is not configured. Open this page in your wallet app, or use a browser extension on desktop.';
  }
  const stripped = message.replace(/\s*Version:\s*@[\w/.-]+/gi, '').trim();
  return stripped || 'Could not connect. Try WalletConnect or open this page in your wallet app.';
}

export function metamaskDappLink(href = 'https://game.blackballs.site/'): string {
  try {
    const url = new URL(href);
    return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}`;
  } catch {
    return 'https://metamask.app.link/dapp/game.blackballs.site/';
  }
}
