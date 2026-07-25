import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const input =
  'C:\\Users\\lotfi\\.cursor\\projects\\c-Users-lotfi-Downloads-fianl-before-edits\\assets\\c__Users_lotfi_AppData_Roaming_Cursor_User_workspaceStorage_cabfaa8dac4bc66f7910db7a115fd193_images_Picsart_26-07-25_12-49-46-317-72b36c7c-323a-4964-99f6-9c2c8fec344b.png';

const output = join(root, 'public', 'blackballs-logo-transparent.png');

function stripBlackSquare(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      // Remove outer black square; keep cyan circle + black line art
      if (max < 28) {
        data[i + 3] = 0;
      }
    }
  }
}

async function main() {
  const base = sharp(input).ensureAlpha();
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  stripBlackSquare(data, info.width, info.height);

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 8 })
    .png()
    .toFile(output);

  console.log('Wrote', output);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
