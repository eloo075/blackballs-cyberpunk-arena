import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outPng = join(root, 'public', 'blackballs-how-to-play-poster.png');
const outSvg = join(root, 'public', 'blackballs-how-to-play-poster.svg');

const W = 1080;
const H = 1440;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" opacity="0.06"/>
    </pattern>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0c18"/>
      <stop offset="100%" stop-color="#050714"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>

  <!-- speed lines -->
  ${Array.from({ length: 18 }, (_, i) => {
    const x = 40 + i * 58;
    return `<line x1="${x}" y1="0" x2="${x + 30}" y2="${H}" stroke="#ffffff" stroke-opacity="0.04" stroke-width="${i % 4 === 0 ? 2 : 1}"/>`;
  }).join('\n')}

  <!-- header burst -->
  <polygon points="420,48 660,48 690,78 660,108 420,108 390,78" fill="#fcee0a" stroke="#000" stroke-width="4"/>
  <text x="540" y="88" text-anchor="middle" fill="#000" font-family="Arial Black, sans-serif" font-size="28" font-weight="900" letter-spacing="6">HOW TO PLAY</text>

  <text x="540" y="165" text-anchor="middle" fill="#00f0ff" font-family="Arial Black, sans-serif" font-size="52" font-weight="900">$BlackBalls</text>
  <text x="540" y="200" text-anchor="middle" fill="#888" font-family="monospace" font-size="18" letter-spacing="4">CYBERPUNK DEGEN ARENA</text>

  <!-- panel helper -->
  ${panel(60, 230, 960, 150, '01', 'THE CRASH', '#00f0ff', 'Live multiplier climbs each round. Enter before or during — close before the CRASH to lock profit. Chart reacts to buy and sell pressure in the round.')}
  ${panel(60, 400, 960, 120, '02', 'ROUND FLOW', '#9d00ff', '')}
  ${flowBox(100, 470, 'WAITING', '#00f0ff')}
  ${arrow(310, 495)}
  ${flowBox(380, 470, 'RUNNING', '#00ff9c')}
  ${arrow(590, 495)}
  ${flowBox(670, 470, 'CRASHED', '#ff003c')}

  ${panel(60, 540, 470, 170, '03', 'BUY LONG', '#00ff9c', 'BUY opens long or closes short. Win when multiplier rises above entry.')}
  ${panel(550, 540, 470, 170, '04', 'SELL SHORT', '#ff003c', 'SELL opens short or closes long. Win when multiplier drops below entry.')}

  ${panel(60, 730, 960, 140, '05', 'WAGER AND LEVERAGE', '#fcee0a', 'Set $BlackBalls wager + leverage 1x–50x. Higher leverage = bigger gains AND bigger losses.')}
  ${panel(60, 890, 960, 150, '06', 'ARENA FIGHTERS', '#e040ff', '12 meme fighters · 2 free · unlock stronger cards with $BlackBalls · win XP and fight coins in battles.')}

  ${panel(60, 1060, 960, 200, '★', 'QUICK START', '#00f0ff', '1. Connect wallet  2. Set wager + leverage  3. BUY or SELL  4. Close before crash  5. Arena battles for XP')}

  <text x="540" y="1320" text-anchor="middle" fill="#666" font-family="monospace" font-size="16" letter-spacing="2">PROVABLY FAIR · 4% HOUSE EDGE · DEGEN RESPONSIBLY</text>
  <text x="540" y="1360" text-anchor="middle" fill="#00f0ff" font-family="Arial Black, sans-serif" font-size="24" font-weight="900">game.blackballs.site</text>
</svg>`;

function panel(x, y, w, h, num, title, accent, body) {
  const textX = x + 20;
  return `
  <g>
    <rect x="${x + 6}" y="${y + 6}" width="${w}" height="${h}" fill="${accent}" opacity="0.9"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0e1428" stroke="#000" stroke-width="4"/>
    <rect x="${x + 12}" y="${y + 12}" width="44" height="44" fill="${accent}" stroke="#000" stroke-width="3"/>
    <text x="${x + 34}" y="${y + 42}" text-anchor="middle" fill="#000" font-family="Arial Black, sans-serif" font-size="20" font-weight="900">${num}</text>
    <text x="${x + 70}" y="${y + 42}" fill="${accent}" font-family="Arial Black, sans-serif" font-size="22" font-weight="900" letter-spacing="2">${title}</text>
    ${body ? `<text x="${textX}" y="${y + 78}" fill="#ccc" font-family="monospace" font-size="16">${wrap(body, w - 40, textX, y + 78)}</text>` : ''}
  </g>`;
}

function flowBox(x, y, label, color) {
  return `
  <g>
    <rect x="${x + 4}" y="${y + 4}" width="200" height="70" fill="${color}"/>
    <rect x="${x}" y="${y}" width="200" height="70" fill="#0a0e1c" stroke="#000" stroke-width="3"/>
    <text x="${x + 100}" y="${y + 44}" text-anchor="middle" fill="${color}" font-family="Arial Black, sans-serif" font-size="20" font-weight="900">${label}</text>
  </g>`;
}

function arrow(x, y) {
  return `<polygon points="${x},${y} ${x + 24},${y + 12} ${x},${y + 24}" fill="#fcee0a" stroke="#000" stroke-width="2"/>`;
}

function wrap(text, maxW, textX, startY) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  let out = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (test.length * 8.5 > maxW && line) {
      out += `<tspan x="${textX}" dy="${y === startY ? 0 : 22}">${line.trim()}</tspan>`;
      line = word + ' ';
      y += 22;
    } else {
      line = test;
    }
  }
  if (line) out += `<tspan x="${textX}" dy="${y === startY ? 0 : 22}">${line.trim()}</tspan>`;
  return out;
}

writeFileSync(outSvg, svg);
await sharp(Buffer.from(svg)).png().toFile(outPng);
console.log('Created', outSvg);
console.log('Created', outPng);
