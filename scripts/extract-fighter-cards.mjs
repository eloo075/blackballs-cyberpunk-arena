import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const poster =
  'C:/Users/lotfi/.cursor/projects/c-Users-lotfi-Downloads-fianl-before-edits/assets/c__Users_lotfi_AppData_Roaming_Cursor_User_workspaceStorage_cabfaa8dac4bc66f7910db7a115fd193_images_blackballs-how-to-play-poster-f85bfc46-6626-4799-bcab-39f59ea8e101.png';

const fighters = [
  'pepe_prime',
  'dogelord',
  'mewtrix',
  'based_frog',
  'wojak',
  'bullx',
  'pingu',
  'zog',
];

async function main() {
  const outDir = join(root, 'public', 'fighters');
  mkdirSync(outDir, { recursive: true });

  const meta = await sharp(poster).metadata();
  const { width, height } = meta;
  const cardW = Math.floor(width / fighters.length);
  const padX = 3;
  const padY = 2;

  for (let i = 0; i < fighters.length; i++) {
    const left = i * cardW + padX;
    const cropW = cardW - padX * 2;
    const cropH = height - padY * 2;

    await sharp(poster)
      .extract({ left, top: padY, width: cropW, height: cropH })
      .resize(320, 480, { fit: 'cover', position: 'top' })
      .png()
      .toFile(join(outDir, `${fighters[i]}.png`));

    console.log(`Wrote ${fighters[i]}.png`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
