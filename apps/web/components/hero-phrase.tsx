'use client';

import { useEffect, useState } from 'react';

const HERO_PHRASES = [
  'signal over noise',
  'chase horizons, not traffic',
  'wild turns, better stories',
  'where the map gets interesting',
  'take the long way on purpose',
  'roads built for goosebumps',
  'detours worth the daylight',
  'find the view before the crowd',
  'trade routine for ridgelines',
  'leave early, wander farther',
  'your next legend starts here',
  'fuel up for unforgettable',
  'more peaks, fewer parking lots',
  'go where cell service gets shy',
  'turn off autopilot, turn on wonder',
  'epic drives, zero chaos',
  'hunt sunsets between exits',
  'choose switchbacks over shortcuts',
  'miles made for mixtapes',
  'roam wider, stop smarter',
  'discover roads with backbone',
  'from city limits to starlight',
  'bold routes for curious souls',
  'plot less, explore more',
  'roadside wonders, front and center',
  'small towns, big adrenaline',
  'scenic now, stories forever',
  'where every mile feels earned',
  'pack light, wander deep',
  'adventure that actually flows',
  'routes with altitude and attitude',
  'find your favorite nowhere',
  'long weekends, longer views',
  'the scenic route bites back',
  'curves, cliffs, and coffee stops',
  'for nights under impossible skies',
  'skip the lines, find the wild',
  'more dirt roads, less doomscroll',
  'every stop a plot twist',
  'northbound on pure curiosity',
  'sunrise drives, campfire nights',
  'make miles feel cinematic',
  'roads that wake you up',
  'launch into your next detour',
  'offbeat routes, on-point planning',
  'wild views with local flavor',
  'get lost on purpose, smartly',
  'drives that earn the postcard',
  'adventure in every lane change',
  'go farther than your usual',
];

const DEFAULT_PHRASE = HERO_PHRASES[0];

const HeroPhrase = () => {
  const [phrase, setPhrase] = useState(DEFAULT_PHRASE);

  useEffect(() => {
    const nextPhrase =
      HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)] ?? DEFAULT_PHRASE;
    setPhrase(nextPhrase);
  }, []);

  return <>{phrase}</>;
};

export default HeroPhrase;
