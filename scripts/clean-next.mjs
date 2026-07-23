import { rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, '.next'), { recursive: true, force: true });
console.log('Removed .next cache');
