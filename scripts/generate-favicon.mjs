import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sources = [
  'C:\\Users\\lotfi\\.cursor\\projects\\c-Users-lotfi-Downloads-fianl-before-edits\\assets\\c__Users_lotfi_AppData_Roaming_Cursor_User_workspaceStorage_cabfaa8dac4bc66f7910db7a115fd193_images_Picsart_26-07-25_12-49-46-317-dfae6af9-489e-416c-8804-8e287ffdac5a.png',
  join(root, 'public', 'favicon-source.png'),
  join(root, 'public', 'blackballs-logo-transparent.png'),
];

async function pickSource() {
  for (const path of sources) {
    try {
      readFileSync(path);
      return path;
    } catch {
      /* try next */
    }
  }
  throw new Error('No favicon source image found');
}

/** Remove outer black square; keep cyan circle + black line art. */
function stripBlackBackground(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 28) {
        data[i + 3] = 0;
      }
    }
  }
}

async function main() {
  const input = await pickSource();
  console.log('Using source:', input);

  const base = sharp(input).ensureAlpha();
  const { data, info } = await base.raw().toBuffer({ resolveWithObject: true });
  stripBlackBackground(data, info.width, info.height);

  let processed = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });

  processed = processed
    .trim({ threshold: 8 })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

  const png512 = await processed.png().toBuffer();

  await sharp(png512).png().toFile(join(root, 'app', 'icon.png'));
  await sharp(png512).resize(180, 180).png().toFile(join(root, 'app', 'apple-icon.png'));
  await sharp(png512).resize(32, 32).png().toFile(join(root, 'public', 'favicon-32.png'));
  await sharp(png512).resize(16, 16).png().toFile(join(root, 'public', 'favicon-16.png'));

  const png32 = await sharp(png512).resize(32, 32).png().toBuffer();
  writeFileSync(join(root, 'app', 'favicon.ico'), buildIco([png32]));

  console.log('Created app/icon.png, app/apple-icon.png, app/favicon.ico, public/favicon-*.png');
}

function buildIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];

  for (const img of images) {
    entries.push({ img, offset });
    offset += img.length;
  }

  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);

  entries.forEach(({ img, offset }, idx) => {
    const o = 6 + idx * 16;
    buf.writeUInt8(32, o);
    buf.writeUInt8(32, o + 1);
    buf.writeUInt8(0, o + 2);
    buf.writeUInt8(0, o + 3);
    buf.writeUInt16LE(1, o + 4);
    buf.writeUInt16LE(32, o + 6);
    buf.writeUInt32LE(img.length, o + 8);
    buf.writeUInt32LE(offset, o + 12);
    img.copy(buf, offset);
  });

  return buf;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
