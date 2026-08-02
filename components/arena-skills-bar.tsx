'use client';

import {
  ARENA_SKILLS,
  canUseSkill,
  type ArenaSkillId,
  type SkillRuntimeState,
} from '@/lib/arena-skills';

interface ArenaSkillsBarProps {
  state: SkillRuntimeState;
  disabled?: boolean;
  onSkill: (id: ArenaSkillId) => void;
}

export function ArenaSkillsBar({ state, disabled, onSkill }: ArenaSkillsBarProps) {
  return (
    <div className="cp-panel px-2 py-2 border border-cp-cyan/30 mb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-black text-white/50 uppercase tracking-wider">Manual Skills</span>
        <span className="text-[10px] text-cp-cyan font-bold">⚡ {state.energy}/5 energy</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
        {ARENA_SKILLS.map(skill => {
          const usable = canUseSkill(state, skill);
          const cd = state.cooldowns[skill.id] ?? 0;
          return (
            <button
              key={skill.id}
              type="button"
              disabled={disabled || !usable}
              title={skill.description}
              onClick={() => onSkill(skill.id)}
              className={`px-1 py-1.5 text-[9px] font-black border rounded-lg transition-all disabled:opacity-30 ${
                usable
                  ? 'bg-cp-cyan/15 text-cp-cyan border-cp-cyan/40 hover:bg-cp-cyan/25'
                  : 'bg-black/30 text-white/30 border-white/10'
              }`}
            >
              <div>{skill.emoji}</div>
              <div className="truncate">{skill.label}</div>
              {cd > 0 && <div className="text-rose-400">CD {cd}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
