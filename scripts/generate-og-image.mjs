import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const logoPath = join(root, 'public', 'blackballs-logo-transparent.png');
const outPath = join(root, 'public', 'og-image.png');

const svgOverlay = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#141518"/>
  <rect x="40" y="40" width="1120" height="550" rx="32" fill="#1f2025" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <text x="600" y="400" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="700">$BlackBalls</text>
  <text x="600" y="470" text-anchor="middle" fill="#fbbf24" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700">Degen Arcade</text>
  <text x="600" y="530" text-anchor="middle" fill="#94a3b8" font-family="Arial,Helvetica,sans-serif" font-size="22">Solana crash game &amp; meme fighter arena</text>
</svg>`;

async function main() {
  const logo = await sharp(logoPath).resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

  const base = sharp(Buffer.from(svgOverlay)).png();
  const { width, height } = await base.metadata();

  await base
    .composite([{ input: logo, top: Math.round(height * 0.14), left: Math.round((width - 220) / 2) }])
    .png()
    .toFile(outPath);

  console.log('Wrote', outPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
