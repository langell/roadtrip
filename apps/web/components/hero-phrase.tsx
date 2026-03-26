'use client';

import { useEffect, useState } from 'react';

type HeroLine = {
  lead: string;
  accent: string;
};

const HERO_LINES: HeroLine[] = [
  { lead: 'Chase horizons with', accent: 'signal over noise' },
  { lead: 'Take the long way with', accent: 'wild turns and better stories' },
  { lead: 'Map your next escape with', accent: 'roads built for goosebumps' },
  { lead: 'Trade routine for ridgelines with', accent: 'adventure that actually flows' },
  { lead: 'Find your favorite nowhere with', accent: 'offbeat routes and local flavor' },
  { lead: 'Roam wider with', accent: 'detours worth the daylight' },
  { lead: 'Launch your next weekend with', accent: 'curves, cliffs, and coffee stops' },
  { lead: 'Go farther than usual with', accent: 'epic drives and zero chaos' },
  { lead: 'Plot less and discover more with', accent: 'smart planning for wild views' },
  { lead: 'Turn wanderlust into mileage with', accent: 'roads that wake you up' },
];

const DEFAULT_LINE = HERO_LINES[0];

const HeroPhrase = () => {
  const [line, setLine] = useState<HeroLine>(DEFAULT_LINE);

  useEffect(() => {
    const nextLine =
      HERO_LINES[Math.floor(Math.random() * HERO_LINES.length)] ?? DEFAULT_LINE;
    setLine(nextLine);
  }, []);

  return (
    <>
      {line.lead} <span className="text-[#3b6090]">{line.accent}</span>
    </>
  );
};

export default HeroPhrase;
