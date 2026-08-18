import { describe, expect, it } from 'vitest';
import {
  friendlyWalletConnectError,
  metamaskDappLink,
  shouldShowInjectedConnect,
} from './wallet-connect-ux';

describe('wallet connect UX', () => {
  it('never surfaces the raw wagmi provider-not-found string', () => {
    expect(
      friendlyWalletConnectError('Provider not found. Version: @wagmi/core@2.22.1'),
    ).toBe('No wallet detected — connect with WalletConnect or open this page in your wallet app.');
  });

  it('shows injected on desktop and in-app browsers, not plain mobile Chrome', () => {
    expect(shouldShowInjectedConnect(false, false)).toBe(true);
    expect(shouldShowInjectedConnect(false, true)).toBe(true);
    expect(shouldShowInjectedConnect(true, true)).toBe(true);
    expect(shouldShowInjectedConnect(true, false)).toBe(false);
  });

  it('builds a MetaMask in-app dapp deep link', () => {
    expect(metamaskDappLink('https://game.blackballs.site/crash')).toBe(
      'https://metamask.app.link/dapp/game.blackballs.site/crash',
    );
  });
});
