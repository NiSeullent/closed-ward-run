/** Keep the phase's supplied track until the next threshold, including bosses/endless. */
export function soundtrackForStage(stage: number) {
  return stage >= 50 ? 4 : stage >= 30 ? 3 : stage >= 15 ? 2 : 0;
}
export const SOUNDTRACK_NAMES = [
  'song1.mp3',
  'closed-run-bgm.mp3',
  'p2.mp3',
  'p3.mp3',
  'bossfinal.mp3',
] as const;
