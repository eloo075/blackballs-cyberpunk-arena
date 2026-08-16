import { it } from 'vitest';
import { main } from './house-edge-sim';

it('measures house edge (print-only)', () => {
  main();
}, 300_000);
