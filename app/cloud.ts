import type { RunMode } from './stages';
import { GameCloud } from './vendor/game-cloud.js';
export { watchGameCloudAuth } from './vendor/game-cloud.js';
/** ZUKU content-scoped Game Cloud runtime, including an opaque iframe bridge. */
export const CLOUD_API = 'https://zuzunza.com/api/v1';
export const DEFAULT_PROJECT = 'cnt_ce447b3687804379845bc5bf77c10a14'; // JUMP content ID, filled during provisioning.
export type Score = {
  id: string;
  name: string;
  distance: number;
  stage: number;
};
export type Peer = {
  lane: number;
  distance: number;
  phase: string;
  updated: number;
  elapsed: number;
  cleared: boolean;
  round: number | null;
  mode?: RunMode;
};
export type Room = {
  roomId: string;
  hostId: string;
  seed: number;
  startsAt: number | null;
  serverTime: number;
  members: {
    id: string;
    name: string;
    state: Peer;
    seq: number;
    seenAt: number;
  }[];
};
export class Cloud {
  private sdk: GameCloud;
  constructor(
    public contentId: string,
    private token = '',
  ) {
    this.sdk = new GameCloud({ contentId, getToken: () => this.token });
  }
  async call<T>(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    return this.sdk.call(action, payload) as Promise<T>;
  }
  context(interactive = true) {
    return this.call<{
      projectId: string;
      player: { id: string; name: string };
    }>('context', { interactive });
  }
  async scores(offset = 0, mode: RunMode = 'story') {
    const data = await this.call<{
      entries: {
        id: string;
        name: string;
        score: number;
        metadata: { stage?: number };
      }[];
      nextOffset: number | null;
    }>('scores-list', {
      board:
        mode === 'endless' ? 'closed-run-endless-v4' : 'closed-run-story-v4',
      offset,
    });
    return {
      rows: data.entries.map((r) => ({
        id: r.id,
        name: r.name,
        distance: r.score,
        stage: r.metadata.stage ?? 1,
      })),
      nextOffset: data.nextOffset,
    };
  }
  submit(score: Score, mode: RunMode = 'story') {
    return this.call('scores-submit', {
      board:
        mode === 'endless' ? 'closed-run-endless-v4' : 'closed-run-story-v4',
      score: score.distance,
      metadata: { stage: score.stage },
    });
  }
  save(data: unknown, mode: RunMode = 'story') {
    return this.call('save', { slot: 'closed-run-v4-' + mode, data });
  }
  load(mode: RunMode = 'story') {
    return this.call<{ data: { best?: number } | null; version: number }>(
      'load',
      { slot: 'closed-run-v4-' + mode },
    );
  }
}
export function parsePeer(p: unknown): Peer | null {
  if (!p || typeof p !== 'object') return null;
  const v = p as Peer;
  return Number.isFinite(v.distance) &&
    v.distance >= 0 &&
    v.distance <= 1000000000 &&
    [-1, 0, 1].includes(v.lane) &&
    ['ready', 'running', 'paused', 'capture', 'over'].includes(v.phase) &&
    Number.isFinite(v.elapsed) &&
    v.elapsed >= 0 &&
    typeof v.cleared === 'boolean' &&
    (v.round === null || Number.isFinite(v.round))
    ? v
    : null;
}
