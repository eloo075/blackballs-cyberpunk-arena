'use client';
import { motion } from 'framer-motion';

interface Entry { rank: number; address: string; xp: number; wins: number; crashes: number; best: number; blackballs: number; }
const NAMES = ['7BxK...3mPq', '9Lam...8vRt', '3Fde...2xWq', 'H8nK...9pLm', '2QaZ...7nDf', '5VkL...1mNb', 'J4pX...8cVg', '6RtY...3qWe', 'K9mN...5bXc', '1ZxV...4pLk', '8GfD...7mJk', '4HbV...2qWx', 'T5nM...9cXd', '7YgF...3pLz', '2RkM...8vBn'];
const RANK_TITLES = ['LEGEND', 'WHALE', 'CHAD', 'APE', 'DEGEN', 'NGMI'];

function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const DATA: Entry[] = NAMES.map((addr, i) => ({
  rank: i + 1,
  address: addr,
  xp: Math.floor(48000 / (i + 1) + seeded(i, 1) * 2000),
  wins: Math.floor(500 / (i + 1) + seeded(i, 2) * 50),
  crashes: Math.floor(300 / (i + 1) + seeded(i, 3) * 80),
  best: parseFloat((seeded(i, 4) * 20 + 2).toFixed(2)),
  blackballs: parseFloat((seeded(i, 5) * 1500 + 250).toFixed(1)),
}))
  .sort((a, b) => b.xp - a.xp)
  .map((e, i) => ({ ...e, rank: i + 1 }));

export function LeaderboardView() {
  return (
    <div className="p-2 sm:p-3 max-w-[1700px] mx-auto w-full font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h2 className="text-lg sm:text-xl font-black tracking-[0.15em] neon-yellow" style={{ fontFamily: 'Orbitron, sans-serif' }}>RANKING</h2>
        <div className="mobile-scroll-x flex gap-2 text-[10px] pb-1">
          {['SEASON_01', 'ALL_TIME', 'WEEKLY'].map((t, i) => (
            <button key={t} className={`cp-btn touch-manipulation touch-target px-3 py-2 font-bold border shrink-0 ${i === 0 ? 'bg-cp-yellow/20 text-cp-yellow border-cp-yellow/50' : 'text-white/30 hover:text-white/60 border-white/10'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 max-w-md mx-auto">
        {[2, 1, 3].map((r, i) => {
          const e = DATA[r - 1];
          const h = r === 1 ? 'h-24' : 'h-16';
          const medal = r === 1 ? '01' : r === 2 ? '02' : '03';
          const col = r === 1 ? '#fcee0a' : r === 2 ? '#00f0ff' : '#ff6b00';
          return (
            <motion.div key={r} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="flex flex-col items-center">
              <div className="text-lg font-black mb-1" style={{ color: col, fontFamily: 'Orbitron, sans-serif' }}>#{medal}</div>
              <div className={`cp-panel w-full ${h} flex flex-col items-center justify-center px-1 hud-corners`} style={{ borderColor: col + '66', background: `linear-gradient(180deg, ${col}22, transparent)` }}>
                <div className="text-[10px] text-white/70">{e.address}</div>
                <div className="text-sm font-black" style={{ color: col }}>{e.xp.toLocaleString('en-US')}</div>
                <div className="text-[8px] text-white/40">XP</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="cp-panel overflow-hidden mobile-scroll-x">
        <table className="w-full text-[11px] min-w-[520px]">
          <thead>
            <tr className="border-b border-cp-cyan/30 text-[9px] uppercase tracking-wider text-white/40">
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">ADDRESS</th>
              <th className="text-right px-3 py-2">RANK</th>
              <th className="text-right px-3 py-2">XP</th>
              <th className="text-right px-3 py-2 hidden sm:table-cell">WINS</th>
              <th className="text-right px-3 py-2 hidden sm:table-cell">CRASHES</th>
              <th className="text-right px-3 py-2">BEST</th>
              <th className="text-right px-3 py-2">$BlackBalls</th>
            </tr>
          </thead>
          <tbody>
            {DATA.map((e, i) => {
              const rankTitle = RANK_TITLES[Math.min(Math.floor(e.xp / 12000), RANK_TITLES.length - 1)];
              const isTop3 = e.rank <= 3;
              return (
                <motion.tr key={e.address} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className={`border-b border-cp-cyan/5 hover:bg-cp-cyan/5 ${isTop3 ? 'bg-cp-yellow/5' : ''}`}>
                  <td className="px-3 py-2"><span className={isTop3 ? 'text-cp-yellow font-bold' : 'text-white/40'}>{e.rank}</span></td>
                  <td className="px-3 py-2 text-white/70">{e.address}</td>
                  <td className="px-3 py-2 text-right"><span className="text-[9px] font-black px-1.5 py-0.5 border" style={{ color: '#ff003c', borderColor: '#ff003c55' }}>{rankTitle}</span></td>
                  <td className="px-3 py-2 text-right font-bold neon-yellow">{e.xp.toLocaleString('en-US')}</td>
                  <td className="px-3 py-2 text-right text-white/60 hidden sm:table-cell">{e.wins}</td>
                  <td className="px-3 py-2 text-right text-white/60 hidden sm:table-cell">{e.crashes}</td>
                  <td className="px-3 py-2 text-right"><span className={e.best >= 10 ? 'text-cp-cyan font-bold' : e.best >= 5 ? 'text-cp-green' : 'text-white/60'}>{e.best.toFixed(2)}x</span></td>
                  <td className="px-3 py-2 text-right neon-cyan">{e.blackballs.toFixed(1)} $BlackBalls</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
