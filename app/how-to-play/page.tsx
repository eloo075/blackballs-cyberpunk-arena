import { HowToPlayGuide } from '@/components/how-to-play-guide';

export const metadata = {
  title: 'How to Play — $BlackBalls Degen Arena',
  description: 'Learn Crash trading and Arena fighters on $BlackBalls',
};

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-[#050714] py-6 px-3 flex flex-col items-center">
      <HowToPlayGuide variant="poster" />
      <p className="mt-4 text-[9px] text-white/30 font-mono text-center max-w-[420px]">
        Screenshot this page to share with your community · No external references — pure $BlackBalls gameplay
      </p>
    </div>
  );
}
