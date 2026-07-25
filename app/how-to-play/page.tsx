import { HowToPlayGuide } from '@/components/how-to-play-guide';

export const metadata = {
  title: 'How to Play — $BlackBalls Degen Arena',
  description: 'Learn Crash trading and Arena fighters on $BlackBalls',
};

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-[#141518] py-6 px-3 flex flex-col items-center font-arcade">
      <HowToPlayGuide variant="poster" />
      <p className="mt-4 text-xs text-white/35 font-bold text-center max-w-[420px]">
        Screenshot &amp; send to your group chat · pure $BlackBalls gameplay, zero cope
      </p>
    </div>
  );
}
