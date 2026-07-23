export const CRASH_VAULT_ABI = [
  {
    type: 'function',
    name: 'withdrawSession',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'depositWager',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'payoutWin',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'processLoss',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sessionBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'vaultBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalEscrowed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'WagerPlaced',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'newSessionBalance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutIssued',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'authorizedBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PlayerLossProcessed',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'burned', type: 'uint256', indexed: false },
      { name: 'toTreasury', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokensBurned',
    inputs: [
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'viaNativeBurn', type: 'bool', indexed: false },
    ],
  },
] as const;
