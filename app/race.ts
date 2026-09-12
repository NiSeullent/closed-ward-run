export type RaceProgress = {
  distance: number;
  elapsed: number;
  phase: string;
  cleared?: boolean;
};
export function raceOutcome(
  local: RaceProgress,
  opponent: RaceProgress | null,
): 'win' | 'lose' | 'draw' | null {
  if (!opponent || local.phase !== 'over' || opponent.phase !== 'over')
    return null;
  if (local.cleared !== opponent.cleared) return local.cleared ? 'win' : 'lose';
  const distance = Math.floor(local.distance) - Math.floor(opponent.distance);
  if (distance !== 0) return distance > 0 ? 'win' : 'lose';
  if (local.cleared && Math.abs(local.elapsed - opponent.elapsed) > 0.05)
    return local.elapsed < opponent.elapsed ? 'win' : 'lose';
  return 'draw';
}
